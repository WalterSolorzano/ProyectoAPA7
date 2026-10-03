---
trigger: always_on
description: Metodología oficial Ciclo Quirúrgico 4-1 y protocolo estricto de ahorro masivo de tokens.
---

# Metodología de Ingeniería: Ciclo Quirúrgico 4-1 & Ahorro de Tokens

## 1. Ciclo de Trabajo Obligatorio (4-1)
Toda tarea de desarrollo en este repositorio sigue obligatoriamente estas 4 fases:

1. **Ubicar sin leer archivos (Fase 1)**:
   - PROHIBIDO leer archivos completos para buscar relaciones o callers.
   - Usar MCP `graphify` (`query_graph`, `shortest_path`, `get_node`) con `token_budget: 1000`.
2. **Plan quirúrgico de ≤5 líneas (Fase 2)**:
   - Antes de escribir o modificar código, emitir un plan conciso de máximo 5 líneas explicando qué archivos se tocarán y por qué.
   - En tareas de envergadura, esperar confirmación antes de tocar el disco.
3. **Micro-Diffs localizados (Fase 3)**:
   - Prohibido reescribir archivos enteros o hacer formateos cosméticos no solicitados.
   - Modificaciones quirúrgicas en bloques de ≤40 líneas usando `replace_file_content`.
4. **Verificación aislada con `-t` (Fase 4)**:
   - Prohibido correr la suite completa en cada micro-cambio.
   - Usar tests específicos: `npm test -- -t "NombreDelComponente"` o `pytest -q python/tests/test_x.py`.
   - La suite completa se corre únicamente antes del commit final de la tarea.

## 2. Arquitectura de Orquestador & Subagentes (Hub & Spoke)
El agente principal opera estrictamente como **Orquestador Central**:
- **Rol del Orquestador**: Mantiene la ventana de contexto principal limpia y ligera (<15k tokens). Coordina estrategia, aprueba planes y aplica micro-diffs quirúrgicos.
- **Prohibido ensuciar contexto**: El orquestador NUNCA lee logs extensos, ni inspecciona >2 archivos, ni realiza búsquedas masivas en el hilo principal.
- **Delegación Obligatoria a Subagentes**:
  - Toda investigación, rastreo de errores, lectura de documentación o auditoría de archivos se delega a un subagente `research` (modelo `flash` o `flash_lite`).
  - El subagente asume los 30k–60k tokens de exploración en su propio hilo desechable.
  - El orquestador recibe únicamente una síntesis estructurada final (ahorro del 95% de tokens en el hilo de trabajo).
- **Control Reactivo**: Al invocar subagentes, el orquestador finaliza su turno sin bucles de polling; el sistema lo reactiva automáticamente con el reporte.

## 3. Commits Atómicos Inmediatos
- Al terminar cada micro-cambio con tests en verde, registrar commit inmediatamente:
  `git add ... ; git commit -m "..."`.
- En caso de regresión persistente tras 2 intentos, revertir con `git restore` en vez de quemar tokens adivinando.

## 4. Fuentes Canónicas y Consulta Quirúrgica de .md
- **`MEMORY.md`**: Consultar exclusivamente líneas 1–45 (~800 tokens vs 5,000+ de git log).
- **`AGENTS.md`**: Consultar únicamente la sección requerida (§1 Producto, §2 Copiloto, §4 Comandos) por rangos de líneas.
- **`mega_set_deteccion_ia.md` (102 KB)**: PROHIBIDO leer completo. Usar `Select-String` o rangos específicos para consultar verbos Bloom o patrones puntuales.
- **`graphify-out/GRAPH_REPORT.md` (57 KB)**: En vez de abrirlo, usar MCP `query_graph(question="...", token_budget=1000)`.

## 5. Filtros Estrictos de Terminal (`token-saver`)
- PowerShell: piping obligatorio `| Select-Object -First 25` o `| Select-String -Pattern "error|fail"`.
- Vitest: `npm test -- --reporter=dot` o `-t "filtro"`.
- Pytest: `pytest -q --tb=short`.
- Git: `git status -s`, `git log -n 5 --oneline`, `git diff --stat`.
- Modo Caveman: Comunicación concisa sin preámbulos (`[cosa] [acción] [razón]. [siguiente paso]`).
