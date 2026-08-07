# WordAPA7 — Engine V2 Mega Plan (Windows + COM first)

> **Decisión de arquitectura**: Word COM es el motor de lectura Y edición.
> python-docx queda solo para generar contenido sintético masivo (portada
> nueva, lista de referencias). Todo lo demás: lectura de estructura,
> aplicación de estilos/fuentes, layout, export PDF — via Word COM nativo.
>
> **Principio**: editar in-place, no reconstruir desde cero.

---

## Contexto firme
- App Windows-only, con Office instalado en la máquina del usuario.
- Prioridad: **fidelidad** (portadas, fuentes, numeración, layout) sobre alcance.
- Fallos reales hoy: portada comida, numeración incorrecta, fuentes sin estandarizar, falla al leer estructuras complejas (fields, SmartArt, OLE, track changes).

---

## Comparativa de estrategias (fallo por fallo)

| Fallo | Árbol OOXML propio | Word vía COM |
|---|---|---|
| Portada mal comida | No lo resuelve solo: el bug es de heurística (`body_start_paragraph_idx`), no de parser | **Resuelto**: `doc.Sections(1).Range` = rango exacto de la portada |
| Numeración incorrecta | Depende de `xml_deep_parser` leer `numbering.xml` — frágil | **Resuelto**: `Paragraph.Range.ListFormat.ListString` = número YA calculado |
| Fuentes sin estandarizar | Iterar runs en XML → verboso y frágil | `doc.Content.Font.Name = "Times New Roman"` → una llamada |
| Estructuras complejas | Reconstruir 30 años de desarrollo de Word | **Resuelto**: `doc.Fields`, `doc.InlineShapes`, `doc.Revisions`, `doc.Sections` — nativos |

---

## Roadmap (COM-first, priorizado)

### P0a — Harness de evaluación (no toca el motor) ✅ DONE
**Objetivo**: tener un corpus de docs + métricas + baseline antes de cambiar nada.

**Entregables**:
- [x] `docs/ENGINE_V2_PLAN.md` — plan maestro completo con comparativa COM vs OOXML, roadmap, métricas
- [x] `python/tests/harness/__init__.py` — módulo de métricas (cover_f1, heading_f1, citation_match, layout_violations, font_compliance, structure_preservation, MetricsReport)
- [x] `python/tests/test_harness.py` — test de harness (corre corpus, reporta métricas, saltea si vacío)
- [x] `python/tests/harness/corpus/README.md` + `_TEMPLATE.expected.json`
- [ ] Corpus de 5-10 docs reales (ideal: `pcp 4m1` y similares) — **PENDIENTE: copiá los .docx acá**
- [ ] Baseline del motor actual contra el corpus — **PENDIENTE: corré `pytest python/tests/test_harness.py` con docs**

### P0b — Migrar lectura de estructura a COM ✅ DONE
**Objetivo**: reemplazar la detección OOXML de secciones/headings/estilos por Word COM Object Model.

**Entregables**:
- [x] `python/parsing/com_reader.py` — lector COM completo: `COMReader.analyze()` + `enrich_document_from_com()`
- [x] `python/services/word_com_service.py` — fix del bug Dispatch (instancia propia + marshalling)
- [x] `python/main.py:upload` — enrichment via COM después del parseo (portada, headings, fuentes, listas)
- [x] Portada: `body_start_paragraph_idx` corregido por `Section(1).Range` (COM) + `is_cover_section` corregido
- [x] Headings: niveles validados contra `OutlineLevel` real de Word, corregidos si difieren

---

### P0c — Generación con COM nativo ✅ PARCIAL
**Objetivo**: aplicar estilos, fuentes y contratos de layout desde Word COM, no desde python-docx.

**Entregables**:
- [x] `_enforce_layout()` en `post_processor.py` — PageBreakBefore (H1, Referencias), KeepWithNext (H1-H3), tablas partidas forzadas a página nueva
- [x] Word COM como autoridad de layout: medición real + corrección declarativa
- [ ] Estilos APA aplicados vía COM (`doc.Styles`, `Heading 1/2/3`) — **PENDIENTE**
- [ ] Fuentes globales vía `doc.Content.Font.Name` con preservación de runs intencionales — **PENDIENTE**

**Fallos que ataca**: fuentes, layout.

---

### P1 — Loop de layout cerrado + consistencia
**Objetivo**: medir el layout real con Word y corregir hasta converger.

**Entregables**:
- [ ] Detección de tablas partidas entre páginas → `pageBreakBefore`
- [ ] Detección de headings huérfanos → `keepNext`
- [ ] Detección de Referencias en página NO nueva → forzar
- [ ] Post-pasada de consistencia (H1→H2, leyendas adyacentes, referencias APA)
- [ ] Medir contra el harness

---

### P2 — Inteligencia (LLM con JSON estructurado)
- [ ] LLM devuelve JSON (Pydantic) para validación global de estructura
- [ ] RAG sobre reglas APA 7 para explicaciones
- [ ] Normalización de citas/referencias via LLM + Crossref

---

### P3 — Arquitectura del producto
- [ ] Store event-sourced (deltas, no docs completos)
- [ ] Backend dueño de la lógica de dominio (quitar duplicación front/back)
- [ ] Sesiones = OOXML + anotaciones, no JSON re-renderizado

---

## Contras de COM y su mitigación

| Riesgo | Mitigación |
|---|---|
| Procesos huérfanos | PID tracking + `psutil.kill()` + `atexit.register(stop)` |
| Diálogos/alertas de Word | `AutomationSecurity=2`, `DisplayAlerts=0`, `ConfirmConversions=False` |
| Threading COM vs FastAPI | `ThreadPoolExecutor` + `CoInitialize()` por hilo; nunca tocar COM desde event loop |
| Rendimiento (muchas llamadas COM) | Batch: `Content.Font.Name` (1 llamada), estilos por Style, nunca iterar runs. Contenido sintético masivo → python-docx |
| Versionado de Office | API COM extremadamente estable desde 2003. Punto débil: Protected View en Office 365 → mitigado con `AutomationSecurity=2` |

---

## Lo que NO cambia (válido sin importar motor)

- **Harness de evaluación** — agnóstico al motor
- **Post-pasada de consistencia estructural** — lógica de dominio pura
- **Principio "editar in-place"** — COM ES la implementación de ese principio
- **LLM con JSON estructurado** — recibe modelo, venga de OOXML o de COM

---

## Calendario concreto

| Sesión | Fase | Entregable específico |
|---|---|---|
| 1 (hoy) | P0a hariko + docs/ENGINE_V2_PLAN.md | Harness metrics module + structure |
| 2 | P0b com_reader | Lector COM de secciones/headings/listas/fuentes/estructuras |
| 3 | P0b portada via COM | Reemplazar body_start detection por Section(1).Range |
| 4 | P0c generación COM | Estilos APA + fuentes via COM nativo |
| 5 | P0c layout COM | _enforce_layout ampliado |
| 6 | P1 loop layout | Tablas partidas, huérfanos, referencias en página nueva |
| 7 | P1 consistencia | Post-pasada de validación estructural |
| 8 | P2 LLM | JSON estructurado + RAG |

---

## Métricas del harness

| Métrica | Qué mide | Objetivo |
|---|---|---|
| Cover F1 | % de elementos de portada correctamente detectados como `is_cover_section` | >0.95 |
| Heading F1 | % de headings correctamente clasificados (nivel + texto) | >0.97 |
| Citation match | ghost_citations + orphan_references = 0 para docs bien formateados | >0.95 |
| Layout violations | headings huérfanos, tablas partidas, referencias sin page break | 0 |
| Font compliance | % de body paragraphs con font APA (Times New Roman 12) | >0.99 |
| Structure preservation | fields, inline shapes, sections sobreviven al round-trip | >0.99 |
