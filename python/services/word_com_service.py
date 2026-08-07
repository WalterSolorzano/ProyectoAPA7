import logging
import sys
import threading
import time
from typing import Any

import psutil

logger = logging.getLogger(__name__)

class WordCOMService:
    """Instancia de Word OWNED por WordAPA7, compartida entre hilos.

    FIX CRÍTICO: antes el `word` property hacía `Dispatch("Word.Application")`,
    que en win32com primero busca una instancia YA ABIERTA (Running Object
    Table). Si el usuario tenía Word abierto con sus propios documentos, nos
    conectábamos a ESA instancia y podíamos tocar sus archivos.

    Ahora la instancia se crea con DispatchEx en un hilo dedicado ("owner"),
    cuya COM apartment queda viva mientras el servicio esté activo. Cada hilo
    de trabajo obtiene una referencia marshalled (CoMarshalInterThreadInterface
    InStream) — nunca re-conectamos por ProgID a una instancia ajena.
    """

    def __init__(self):
        self._lock = threading.RLock()
        self.is_windows = sys.platform == "win32"
        self._word = None
        self._pid = None
        self._git = None
        self._cookie = None
        self._owner_thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._stop = False

    def is_available(self) -> bool:
        if not self.is_windows:
            return False
        try:
            import win32com.client  # noqa
        except ImportError:
            return False
        # Verificar que Word esté realmente instalado (WINWORD.EXE presente)
        try:
            import shutil
            from pathlib import Path
            winword = shutil.which("WINWORD.EXE") or Path(
                r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"
            )
            if winword and Path(winword).exists():
                return True
            for office in ["Office16", "Office15", "Office14"]:
                for pf in [r"C:\Program Files\Microsoft Office", r"C:\Program Files (x86)\Microsoft Office"]:
                    if (Path(pf) / "root" / office / "WINWORD.EXE").exists():
                        return True
            return False
        except Exception:
            return False

    def _create_word_instance(self):
        """Crea la instancia DispatchEx en el hilo owner y la registra en GlobalInterfaceTable."""
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        pids_before = set(p.pid for p in psutil.process_iter(['name']) if p.info['name'] == 'WINWORD.EXE')
        word = win32com.client.DispatchEx("Word.Application")
        pids_after = set(p.pid for p in psutil.process_iter(['name']) if p.info['name'] == 'WINWORD.EXE')
        new_pids = pids_after - pids_before
        self._pid = new_pids.pop() if new_pids else None

        word.Visible = False
        word.DisplayAlerts = 0
        self._word = word

        try:
            git = pythoncom.CoCreateInstance(
                pythoncom.CLSID_StdGlobalInterfaceTable,
                None,
                pythoncom.CLSCTX_INPROC_SERVER,
                pythoncom.IID_IGlobalInterfaceTable
            )
            cookie = git.RegisterInterfaceInGlobal(word._oleobj_, pythoncom.IID_IDispatch)
            self._git = git
            self._cookie = cookie
        except Exception as ge:
            logger.warning(f"[WordCOMService] GIT no disponible: {ge}")

        self._ready.set()
        logger.info(f"[WordCOMService] Instancia compartida de Word iniciada (PID: {self._pid}).")

    def _run_owner(self):
        """Mantiene viva la COM apartment del hilo dueño mientras el servicio esté activo."""
        try:
            self._create_word_instance()
        except Exception as e:
            logger.error(f"[WordCOMService] Error iniciando Word: {e}")
            self._word = None
            self._ready.set()
            return
        # Loop de mantenimiento: no llamar CoUninitialize hasta el stop,
        # así la instancia DispatchEx sigue válida para otros hilos.
        while not self._stop:
            time.sleep(0.5)
        try:
            if self._git and self._cookie:
                self._git.RevokeInterfaceFromGlobal(self._cookie)
                self._cookie = None
                self._git = None
        except Exception:
            pass
        try:
            import pythoncom
            pythoncom.CoUninitialize()
        except Exception:
            pass

    def start(self):
        if not self.is_windows:
            return
        with self._lock:
            if self._word is not None or self._owner_thread is not None:
                return
            self._ready.clear()
            self._stop = False
            self._owner_thread = threading.Thread(
                target=self._run_owner, daemon=True, name="WordAPA7-COM-owner"
            )
            self._owner_thread.start()
            self._ready.wait(timeout=25)

    def stop(self):
        self._stop = True
        with self._lock:
            if self._git and self._cookie:
                try:
                    self._git.RevokeInterfaceFromGlobal(self._cookie)
                except Exception:
                    pass
                self._cookie = None
                self._git = None
            if self._word:
                try:
                    self._word.Quit(0)
                except Exception:
                    pass
                self._word = None
            if self._pid:
                try:
                    p = psutil.Process(self._pid)
                    if p.name() == 'WINWORD.EXE':
                        p.kill()
                        time.sleep(0.5)
                except Exception:
                    pass
                self._pid = None
            self._owner_thread = None
        self._ready.clear()

    def kill_created_word(self):
        """Mata el proceso WINWORD.EXE creado por esta instancia (si está colgado)."""
        with self._lock:
            pid = self._pid
        if pid:
            try:
                p = psutil.Process(pid)
                if p.name() == 'WINWORD.EXE':
                    p.kill()
            except Exception:
                pass
            self._pid = None
            self._word = None
            self._git = None
            self._cookie = None

    def _thread_handle(self) -> Any:
        """Devuelve una referencia a la instancia marshalled para el hilo actual usando GIT."""
        import pythoncom
        import win32com.client

        if self._git and self._cookie:
            obj = self._git.GetInterfaceFromGlobal(self._cookie, pythoncom.IID_IDispatch)
            return win32com.client.Dispatch(obj)

        if self._word is None:
            return None
        return self._word

    def _restart(self):
        with self._lock:
            self._stop = True
            if self._git and self._cookie:
                try:
                    self._git.RevokeInterfaceFromGlobal(self._cookie)
                except Exception:
                    pass
                self._cookie = None
                self._git = None
            if self._word:
                try:
                    self._word.Quit(0)
                except Exception:
                    pass
                self._word = None
            if self._pid:
                try:
                    p = psutil.Process(self._pid)
                    if p.name() == 'WINWORD.EXE':
                        p.kill()
                except Exception:
                    pass
                self._pid = None
            self._owner_thread = None
            self._ready.clear()
            self._stop = False
            self.start()

    @property
    def word(self) -> Any:
        """Referencia thread-safe a la instancia que CREAMOS (nunca a una ajena)."""
        if not self.is_windows:
            return None
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except Exception:
            pass

        with self._lock:
            if self._word is None:
                self.start()
            if self._word is None:
                return None
            try:
                handle = self._thread_handle()
                _ = handle.Name  # sondeo de liveness
                return handle
            except Exception:
                logger.warning("[WordCOMService] Instancia de Word no responde, reiniciando...")
                self._restart()
                if self._word is None:
                    return None
                return self._thread_handle()


# Singleton
_word_com_service = WordCOMService()

def get_word_com_service() -> WordCOMService:
    return _word_com_service
