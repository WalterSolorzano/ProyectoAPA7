"""Cola y tiempos del trabajo LLM interno.

El scheduler es la unica verdad de concurrencia: el frontend solo reporta que
elementos se ven y los motores se ejecutan por elemento, una vez por contenido.
El dispatcher arranca en el primer encolado, nunca en el lifespan de FastAPI.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

AI_MAX_CONCURRENCY = int(os.getenv("AI_MAX_CONCURRENCY", "2"))
AI_COPILOT_RESERVED_SLOTS = int(os.getenv("AI_COPILOT_RESERVED_SLOTS", "1"))
AI_JOB_DEADLINE_S = float(os.getenv("AI_JOB_DEADLINE_S", "25"))
AI_JOB_MAX_ATTEMPTS = int(os.getenv("AI_JOB_MAX_ATTEMPTS", "3"))

PRIORITY_COPILOT = 0
PRIORITY_MANUAL = 5
PRIORITY_VISIBLE = 10
PRIORITY_BACKGROUND = 20
PRIORITY_PREFETCH = 30

_RESULT_PREFIX = "sched:"
_PARAMS_VERSION = "v1"

Runner = Callable[["Job"], Awaitable[Optional[Any]]]
_RUNNERS: Dict[str, Runner] = {}


def content_hash(motor: str, text: str, phase: str = "",
                 params_version: str = _PARAMS_VERSION) -> str:
    """Hash canonico de "esto ya se hizo". Sin session_id: reusa entre sesiones."""
    normalizado = " ".join((text or "").split())
    crudo = f"{motor}|{phase or ''}|{normalizado}|{params_version}"
    return hashlib.sha256(crudo.encode("utf-8")).hexdigest()


def _load_result(chash: str) -> Optional[Any]:
    from modules.ai_client import _load_cache

    crudo = _load_cache().get(_RESULT_PREFIX + chash)
    if crudo is None:
        return None
    try:
        return json.loads(crudo)
    except Exception:
        return None


def _store_result(chash: str, value: Any) -> None:
    from modules.ai_client import _save_cache

    _save_cache({_RESULT_PREFIX + chash: json.dumps(value, ensure_ascii=False)})


def register_runner(motor: str, fn: Runner) -> None:
    _RUNNERS[motor] = fn


@dataclass
class Job:
    id: str
    session_id: str
    motor: str
    element_id: str
    content_hash: str
    priority: int
    seq: int
    enqueued_at: float
    deadline_s: float
    payload: Dict[str, Any] = field(default_factory=dict)
    attempts: int = 0
    state: str = "queued"  # queued|running|done|pending|failed|cancelled
    result: Optional[Any] = None
    provider: Optional[str] = None
    error: Optional[str] = None


class Scheduler:
    def __init__(self) -> None:
        self._queue: "asyncio.PriorityQueue[Tuple[int, int, str]]" = asyncio.PriorityQueue()
        self._sem = asyncio.Semaphore(max(1, AI_MAX_CONCURRENCY - AI_COPILOT_RESERVED_SLOTS))
        self._jobs: Dict[str, Job] = {}
        self._by_session: Dict[str, List[str]] = {}
        self._by_hash: Dict[str, str] = {}
        self._cancelled: Dict[str, bool] = {}
        self._lock = asyncio.Lock()
        self._seq = 0
        self._dispatcher: Optional[asyncio.Task] = None
        self._tasks: set = set()

    def _ensure_dispatcher(self) -> None:
        if self._dispatcher is None or self._dispatcher.done():
            self._dispatcher = asyncio.create_task(self._serve())

    def _nuevo_id(self) -> str:
        return uuid.uuid4().hex

    async def _serve(self) -> None:  # pragma: no cover - cubierto por tests de flujo
        while True:
            _priority, _seq, job_id = await self._queue.get()
            job = self._jobs.get(job_id)
            if job is None or job.state != "queued":
                continue
            if self._cancelled.get(job.session_id):
                job.state = "cancelled"
                continue
            tarea = asyncio.create_task(self._run(job))
            self._tasks.add(tarea)
            tarea.add_done_callback(self._tasks.discard)

    async def _run(self, job: Job) -> None:
        usa_sem = job.priority > PRIORITY_COPILOT
        if usa_sem:
            await self._sem.acquire()
        try:
            job.state = "running"
            job.attempts += 1
            runner = _RUNNERS.get(job.motor)
            if runner is None:
                job.state = "failed"
                job.error = f"sin runner para {job.motor}"
                return
            try:
                resultado = await asyncio.wait_for(runner(job), timeout=job.deadline_s)
            except asyncio.TimeoutError:
                job.error = "deadline"
                resultado = None
            except Exception as e:  # noqa: BLE001 - el scheduler nunca cae por un motor
                job.error = str(e)
                logger.warning("[Scheduler] job %s fallo: %s", job.id, e)
                resultado = None
            if self._cancelled.get(job.session_id):
                job.state = "cancelled"
                return
            if resultado is None:
                job.state = "failed" if job.attempts >= AI_JOB_MAX_ATTEMPTS else "pending"
                return
            job.result = resultado
            _store_result(job.content_hash, resultado)
            job.state = "done"
        finally:
            if usa_sem:
                self._sem.release()

    async def enqueue(self, session_id: str, motor: str, element_id: str,
                      text: str, *, phase: str = "",
                      priority: int = PRIORITY_BACKGROUND,
                      deadline_s: Optional[float] = None,
                      payload: Optional[Dict[str, Any]] = None,
                      params_version: str = _PARAMS_VERSION) -> str:
        chash = content_hash(motor, text, phase, params_version)
        async with self._lock:
            self._cancelled[session_id] = False
            existente = self._by_hash.get(chash)
            if existente is not None:
                ej = self._jobs.get(existente)
                if ej is not None and ej.session_id == session_id \
                        and ej.state in ("queued", "running", "done"):
                    return existente
            self._seq += 1
            base = dict(
                session_id=session_id, motor=motor, element_id=element_id,
                content_hash=chash, priority=priority, seq=self._seq,
                enqueued_at=time.time(),
                deadline_s=deadline_s or AI_JOB_DEADLINE_S, payload=payload or {},
            )
            cacheado = _load_result(chash)
            if cacheado is not None:
                job = Job(id=self._nuevo_id(), state="done", result=cacheado, **base)
            else:
                job = Job(id=self._nuevo_id(), **base)
            self._jobs[job.id] = job
            self._by_hash[chash] = job.id
            self._by_session.setdefault(session_id, []).append(job.id)
            if job.state == "queued":
                self._queue.put_nowait((priority, job.seq, job.id))
        self._ensure_dispatcher()
        return job.id

    async def enqueue_many(self, session_id: str, motor: str,
                           items: List[Dict[str, Any]], *,
                           priority: int = PRIORITY_BACKGROUND,
                           deadline_s: Optional[float] = None) -> List[str]:
        ids: List[str] = []
        for it in items:
            ids.append(await self.enqueue(
                session_id, motor, it["element_id"], it.get("text", ""),
                phase=it.get("phase", ""), priority=priority,
                deadline_s=deadline_s, payload=it.get("payload"),
            ))
        return ids

    async def resume_pending(self, session_id: str,
                             motors: Optional[List[str]] = None) -> int:
        async with self._lock:
            self._cancelled[session_id] = False
            n = 0
            for jid in self._by_session.get(session_id, []):
                job = self._jobs.get(jid)
                if job is None or job.state not in ("pending", "failed"):
                    continue
                if motors and job.motor not in motors:
                    continue
                job.state = "queued"
                job.attempts = 0
                self._by_hash[job.content_hash] = job.id
                self._queue.put_nowait((job.priority, job.seq, job.id))
                n += 1
        if n:
            self._ensure_dispatcher()
        return n

    async def cancel_session(self, session_id: str) -> int:
        async with self._lock:
            self._cancelled[session_id] = True
            n = 0
            for jid in self._by_session.get(session_id, []):
                job = self._jobs.get(jid)
                if job is not None and job.state == "queued":
                    job.state = "cancelled"
                    self._by_hash.pop(job.content_hash, None)
                    n += 1
            return n

    def status(self, session_id: str) -> Dict[str, Any]:
        jobs = [self._jobs[j] for j in self._by_session.get(session_id, []) if j in self._jobs]
        motores: Dict[str, Dict[str, int]] = {}
        for j in jobs:
            m = motores.setdefault(j.motor, {})
            m[j.state] = m.get(j.state, 0) + 1
        return {
            "session_id": session_id,
            "motores": motores,
            "jobs": [
                {"id": j.id, "motor": j.motor, "element_id": j.element_id,
                 "state": j.state, "provider": j.provider,
                 "result": j.result if j.state == "done" else None}
                for j in jobs
            ],
        }


_SCHEDULER: Optional[Scheduler] = None


def get_scheduler() -> Scheduler:
    global _SCHEDULER
    if _SCHEDULER is None:
        _SCHEDULER = Scheduler()
    return _SCHEDULER
