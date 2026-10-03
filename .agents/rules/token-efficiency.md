---
trigger: always_on
description: Protocolo estricto de gobernanza documental y ahorro masivo de tokens en cada consulta.
---

# Protocolo de Documentación y Ahorro Masivo de Tokens

## 1. Documentación Viva Preservada (Fuentes Canónicas)
- **Reglas**: `AGENTS.md` (contratos COM lazy, zero emojis, design tokens, fases), `.agents/rules/` (`graphify.md`, `skills.md`, `token-efficiency.md`).
- **Diseño & Memoria**: `DESIGN.md`, `PRODUCT.md`, `MEMORY.md`, `plan-motor-rendimiento.md`.
- **Specs Maestras**: `docs/superpowers/specs/` (taxonomía de fases, catálogo de 58 reglas, superficies).
- **Planes Vigentes**: `docs/superpowers/plans/` (F6, F7, F8, rediseño revisión IA).

## 2. Uso Estratégico de .md para Ahorrar Miles de Tokens
- **`MEMORY.md`**: En vez de correr `git log` o reconstruir historial, leer exclusivamente líneas 1–45 (~800 tokens vs 5,000+).
- **`AGENTS.md`**: Consultar únicamente la sección requerida (§1 Producto, §2 Copiloto, §4 Comandos) con `StartLine` y `EndLine`.
- **`mega_set_deteccion_ia.md` (102 KB, ~27k tokens)**: PROHIBIDO leer completo. Usar `Select-String` o rangos específicos para consultar verbos Bloom o patrones puntuales.
- **`graphify-out/GRAPH_REPORT.md` (57 KB)**: En vez de abrirlo, usar MCP `query_graph(question="...", token_budget=1000)` para obtener solo el subgrafo exacto (<1k tokens).

## 3. Guía de Ahorro de Tokens en Cada Consulta
- **Aislamiento con Subagentes**: Tareas de investigación de >3 archivos se delegan a subagentes (`research` con modelo `flash` o `flash_lite`). El contexto principal no se satura y solo recibe la síntesis final.
- **Think-in-Code con MCP context-mode (`ctx_execute`)**: Para procesar o filtrar listas de archivos, correr scripts en Node/Bun en el sandbox; la data cruda se procesa fuera del contexto y solo entra el resultado final de ≤15 líneas.
- **Piping estricto de terminal (`token-saver`)**:
  - PowerShell: `| Select-Object -First 25` o `| Select-String -Pattern "error|fail"`.
  - Vitest: `npm test -- --reporter=dot` o `-t "nombre_del_test"`.
  - Pytest: `pytest -q --tb=short python/tests/test_x.py`.
  - Git: `git status -s`, `git log -n 5 --oneline`, `git diff --stat`.
- **Lectura quirúrgica**: `view_file` con bloques de ≤80 líneas. Prohibido volcar archivos de >100 líneas.
- **Modo Caveman**: Comunicación concisa sin preámbulos (`[cosa] [acción] [razón]. [siguiente paso]`). Ahorro del 40-60% de tokens de salida.
