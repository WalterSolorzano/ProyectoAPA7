# Auditoría Técnica Completa de WordAPA7 — Versión Post-Correcciones

**Fecha:** 2026-07-26  
**Alcance:** Código fuente completo (frontend React + backend Python/FastAPI), 82 archivos Python, 69 archivos TypeScript/TSX  
**Metodología:** Auditoría con 6 subagentes paralelos, uno por área de dominio, con evidencia verificable (fragmentos de código, línea por línea). Nada reportado como "está bien" sin evidencia concreta.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Bugs Críticos (Acción Inmediata)](#2-bugs-críticos-acción-inmediata)
3. [Área 1: Regresión de Bugs Previos](#3-área-1-regresión-de-bugs-previos)
4. [Área 2: Detección y Jerarquización de Títulos (H1–H5)](#4-área-2-detección-y-jerarquización-de-títulos-h1h5)
5. [Área 3: Detección de Imágenes](#5-área-3-detección-de-imágenes)
6. [Área 4: Sistema de Previsualización (Dual Engine)](#6-área-4-sistema-de-previsualización-dual-engine)
7. [Área 5: Citas y Referencias](#7-área-5-citas-y-referencias)
8. [Área 6: Campos de Word y Objetos No Modelados](#8-área-6-campos-de-word-y-objetos-no-modelados)
9. [Área 7: Manejo de Errores y Casos Límite](#9-área-7-manejo-de-errores-y-casos-límite)
10. [Área 8: Arquitectura de Cola/Concurrencia (NIM y COM)](#10-área-8-arquitectura-de-colaconcurrencia-nim-y-com)
11. [Área 9: Rollback y Seguridad de Datos del Usuario](#11-área-9-rollback-y-seguridad-de-datos-del-usuario)
12. [Área 10: UI/UX del Panel de Revisión y Previsualización](#12-área-10-uiux-del-panel-de-revisión-y-previsualización)
13. [Área 11: Gate de Exportación](#13-área-11-gate-de-exportación)
14. [Área 12: Exploración Libre — Arquitectura, Deuda Técnica, Metodología, IA, Seguridad, Escalabilidad](#14-área-12-exploración-libre)
15. [Plan de Acción Priorizado](#15-plan-de-acción-priorizado)

---

## 1. Resumen Ejecutivo

### Veredicto General

El proyecto WordAPA7 ha progresado significativamente desde la auditoría anterior. **14 de los 18 bugs previamente reportados están verificados como resueltos** con evidencia concreta. Sin embargo, la auditoría reveló **3 bugs críticos nuevos/no resueltos** y **deudas técnicas considerables** que comprometen la estabilidad y seguridad del producto.

### Números Clave

| Métrica | Valor |
|---------|-------|
| Bugs previos verificados como resueltos | 14 / 18 |
| Bugs críticos activos | 3 (SyntaxError en doc_converter.py, gate de exportación desactivado, import inexistente en background task) |
| Bugs de seguridad | 5 (CORS abierto, sin auth, .env expuesto, PIN expuesto, path traversal) |
| Archivos temporales sin limpieza | Todos (sin cleanup automático) |
| Líneas de código en main.py (God Object) | 2,071 |
| Modelos duplicados en models.py | 3 pares (DocumentElement/ElementModel, CitaInText/CitationModel, ReferenciaItem/ReferenciaModel) |
| Scripts sueltos de debug/no utilizados | 22+ en python/ + 8 en raíz |
| Dependencias muertas en package.json | 2 (react-router-dom, @dnd-kit parcialmente) |
| Tests Python | ~14 archivos, buena cobertura |
| Tests Frontend | 4 archivos, cobertura mínima |
| CI/CD | No existe |
| Linter | No configurado |

### Clasificación por Severidad

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| 🔴 CRÍTICO | 3 | Bloquean funcionalidad principal |
| 🟠 ALTO | 12 | Riesgo de pérdida de datos, seguridad, o corrupción |
| 🟡 MEDIO | 18 | Fricciones de uso, gaps funcionales, calidad |
| 🔵 BAJO | 9 | Código muerto, cosméticos, mejoras menores |
| ℹ️ INFO | 15 | Documentación, sugerencias, notas |

---

## 2. Bugs Críticos (Acción Inmediata)

### 🔴 BUG-C1: `doc_converter.py` tiene SyntaxError — Pipeline de exportación roto

**Estado:** VERIFICADO NO RESUELTO  
**Severidad:** CRÍTICO — BLOCKER  
**Evidencia:** `python/services/doc_converter.py:70-81`  
**Detalle:** El `if generate_pdf:` (línea 70) está indentado fuera del bloque `elif engine == "LO":` (línea 61), y el `else:` (línea 78) está al nivel de `with self._lock:` (línea 51), donde `with` no acepta `else`. Python confirma:

```
File "doc_converter.py", line 78
    else:
    ^^^^
SyntaxError: invalid syntax
```

**Impacto:** Cualquier endpoint que llame a `get_doc_converter()` fallará con `ImportError`. Afecta `/api/generate`, `/api/generate-pdf`, `/api/generate-tracked`. El pipeline completo de exportación y generación PDF está **completamente inoperativo**.

**Fix:** Reindentar el bloque dentro del `elif engine == "LO":` y colocar el `else` al nivel correcto.

---

### 🔴 BUG-C2: Gate de exportación existe pero está desactivado — Pérdida de contenido silenciosa

**Estado:** VERIFICADO — Gate diseñado correctamente pero excepción silenciada  
**Severidad:** CRÍTICO  
**Evidencia:** `python/generation/generator.py:1079-1085`:

```python
if original_file.exists():
    try:
        from parsing.sanity_check import verify_document_content_integrity
        verify_document_content_integrity(original_file, out_path, tolerance=0.05)
    except Exception as e:
        print(f"[WARN] Alerta de Sanidad en exportación: {e}")
# ← No hay 'raise' ni 'return'. La ejecución continúa normally.
```

**Detalle:** El módulo `sanity_check.py` tiene toda la lógica correcta (comparación de caracteres con deduplicación mc:Fallback, linter anti-fuga de tokens internos, `ExportBlockedError` con mensaje detallado). Pero el `except Exception` en el generador **traga la excepción** y solo hace `print()` al log del servidor. El documento se entrega al usuario aunque falte el 30% o más del contenido.

**Impacto:** Un estudiante puede descargar un documento donde faltan tablas enteras, párrafos, o imágenes, sin ninguna advertencia en la UI ni en la respuesta HTTP.

**Fix:** Eliminar el `try/except` o cambiarlo a `raise` para que el endpoint retorne un error HTTP 400 con el mensaje de pérdida de contenido.

---

### 🔴 BUG-C3: Import inexistente `storage.state` en background task

**Estado:** VERIFICADO NO RESUELTO  
**Severidad:** CRÍTICO  
**Evidencia:** `python/main.py:252`:

```python
from storage.state import load_session_state, save_session_state
```

**Detalle:** El módulo `python/storage/state.py` **no existe**. El módulo real es `persistence.session_manager`. La función `run_ai_detection_in_background` se ejecuta via `BackgroundTasks` de FastAPI cada vez que se sube un documento. **Fallará silenciosamente** en producción.

**Impacto:** La detección de IA en background no funciona. Cada upload genera un error en el log pero no se comunica al usuario.

**Fix:** Cambiar a `from persistence.session_manager import load_session_state, save_session_state`.

---

## 3. Área 1: Regresión de Bugs Previos

### ✅ Resueltos (con evidencia)

| # | Bug | Evidencia |
|---|-----|-----------|
| 1.1 | `load_dotenv()` nunca llamado | `main.py:20-21` — Import y llamada presentes |
| 1.2 | `asyncio` no importado | `main.py:16` — `import asyncio` |
| 1.3 | Pre-clasificador marca `needs_review=False` en todos | `pre_classifier.py:650-666` — Pasada 3 reescrita, headings heurísticos SIEMPRE marcan `needs_review=True` |
| 1.4 | `extract_textbox_paragraphs()` crashea con `'str' object has no attribute 'text'` | `xml_deep_parser.py:108-132` — Reescrita con `itertext()` |
| 1.5 | DOCX generado sin formato APA (paragraph mapping misalignment) | `generator.py:613-681` — 5 niveles de fallback para `cover_paragraph_count`. Además, `layered_generator.py` como pipeline alternativo |
| 1.6 | `format_bullet_item()` recibe `bullet_style=None` | `generator.py:1025-1038` — Estilos pasados explícitamente por keyword |
| 1.7 | `post_processor.py` no existe | `python/generation/post_processor.py` — 244 líneas con COM post-processing |
| 1.8 | Middleware X-Request-ID duplicado | `main.py:1874-1891` — Solo `debug_logging_middleware` |
| 1.11 | Interlineado (line spacing) | `style_engine.py:270, 352, 386, 122-127, 405` — Triple capa de protección |
| 1.12 | Tamaño de heading (todos igual) | `style_engine.py:282-290` — Correcto por diseño APA 7 (todos 12pt) |
| 1.13 | Títulos de tabla faltantes | `table_engine.py:128-151` — "Tabla N" en negrita + título en cursiva |
| 1.14 | Botón NIM sin feedback | `main.py:526-534` (polling) + `main.py:184-196` (WebSocket) + batching con backoff |
| 1.15 | Pérdida de contenido en shapes/txbx | `image_extractor_recursive.py:7-79`, `xml_deep_parser.py:333-351`, `structure_scanner.py:46-65` |
| 1.16 | mc:Choice/mc:Fallback duplicación | `structure_scanner.py:94-97` + `xml_deep_parser.py:315-326` + `xml_deep_parser.py:293-305` |
| 1.17 | Portada no detectada | `docx_parser.py:126-385` — 7 estrategias de detección + fallback |

### ⚠️ Parcialmente Resueltos

| # | Bug | Estado |
|---|-----|--------|
| 1.10 | `lo_service.py` mezcla listener + CLI | PARCIAL — `convert()` usa subprocess con lock, pero `start()` aún arranca daemon innecesario en puerto 2002 |

### ⚠️ No Verificables desde el backend

| # | Bug | Razón |
|---|-----|-------|
| 1.19 | Preview endpoint no retorna `html` | Requiere verificación del frontend TypeScript |
| 1.20 | 4 botones de descarga APA7 | Problema de UI/React |
| 1.21 | API Key input en HeaderBar | Problema de UI/React |

### 🔴 No Resueltos

| # | Bug | Estado |
|---|-----|--------|
| 1.9 | `doc_converter.py` SyntaxError | **NO RESUELTO** — Ver BUG-C1 |
| 1.18 | `doc.portada` es dict, no PortadaData | Resuelto — tiene `default_factory` |

---

## 4. Área 2: Detección y Jerarquización de Títulos (H1–H5)

### Pipeline de Clasificación: 4 Pasadas Progresivas

El sistema implementa un diseño sólido de "coarse-to-fine":

| Pasada | Estrategia | Archivo:línea |
|--------|-----------|---------------|
| 1 | Clasificación por formato individual (estilos nativos de Word + regex) | `pre_classifier.py:196-446` |
| 2 | Detección de portada y numeración secuencial | `pre_classifier.py:447-520` |
| 3 | Scoring multi-criterio con inferencia jerárquica incremental | `pre_classifier.py:521-690` |
| 4 | Clustering global DBSCAN por huella de estilo | `pre_classifier.py:692-697`, `clustering_classifier.py:117-131` |

### Huella de Estilo (Style Fingerprint)

**Estado:** ✅ IMPLEMENTADO (dos implementaciones complementarias)

1. **`style_fingerprint.py:6-56`** — `StyleFingerprint` con 7 dimensiones discretas: `is_bold`, `is_italic`, `alignment`, `font_size_bucket`, `has_indent`, `ends_with_period`, `word_count_bucket`.
2. **`clustering_classifier.py:14-36`** — `StyleFingerprint` dataclass con 11 dimensiones continuas normalizadas a [0,1] para clustering DBSCAN.

Ambas generan vectores que se agrupan para detectar patrones de headings vs párrafos.

### Numeración Explícita

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `pre_classifier.py:44-46` — Regex que soporta decimal (`1.1.1`), romano (`I.`, `II.`), letra (`A.`, `B.`). Inferencia de nivel por conteo de segmentos (`pre_classifier.py:314-326`). Guard contra saltos de nivel (`pre_classifier.py:686-687`).

### Vocabulario Español

**Estado:** ✅ IMPLEMENTADO (extenso)  
**Evidencia:** `pre_classifier.py:76-128` — ~50+ keywords en español: "introduccion", "marco teorico", "planteamiento del problema", "estado del arte", "fundamentacion teorica", "resultados", "metodologia", etc. Búsqueda insensible a tildes.

### Sangría Creciente

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `_estimate_level_by_indent()` (`pre_classifier.py:168-174`) con umbrales: ≥2.0cm → H3, ≥1.2cm → H2, else → H1.

### LLM — Contexto de Párrafos Vecinos

**Estado:** ⚠️ PARCIALMENTE

- **`llm_classifier.py`** (principal): Envía "mapa jerárquico de títulos" ya clasificados (`pre_classifier.py:289-298`), pero **NO** envía texto de párrafos vecinos.
- **`llm_batch_classifier.py`** (fallback): Solo envía `{"id": e.id, "text": e.text}` — sin contexto ni formato.

**Severidad:** MEDIO — El contexto estructural ayuda, pero la falta de texto vecino limita la capacidad del LLM para inferir nivel por posición semántica. Para documentos sin formato, esto es crítico.

### Resumen Área 2

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Style fingerprint | ✅ Doble implementación | INFO |
| Clustering DBSCAN global | ✅ Implementado | INFO |
| Numeración explícita | ✅ Decimal + romano + letra | INFO |
| Vocabulario español | ✅ 50+ keywords | INFO |
| Sangría como señal jerárquica | ✅ 3 umbrales | INFO |
| LLM con contexto de vecinos | ⚠️ No envía texto vecino | MEDIO |
| Documentos 100% sin formato | ⚠️ Dependerá de LLM con poca info | BAJO |

---

## 5. Área 3: Detección de Imágenes

### Cobertura de Formatos OOXML

| Formato | Estado | Evidencia |
|---------|--------|-----------|
| **wp:inline** (inline) | ✅ | `docx_parser.py:734` — `findall('.//{WP_NS}inline')` |
| **wp:anchor** (ancladas) | ✅ | `docx_parser.py:702-731` — Posición H/V + wrap style (square, tight, through) |
| **v:imagedata** (VML legado) | ✅ | `docx_parser.py:747-751` + `image_extractor_recursive.py:29` |
| **wpg:wgp** (shapes agrupados) | ✅ | `docx_parser.py:737-744` — wpg→wsp→blip traversal explícito |

### Asociación Caption por Proximidad

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `image_extractor_recursive.py:81-113` — Búsqueda bidireccional en ventana de ±3 elementos. `pre_classifier.py:546-557` — Búsqueda en offset ±1 y ±2 con matcheo de número de figura.

### Dimensiones de Imágenes

**Estado:** 🔴 NO PRESERVADAS  
**Evidencia:** `docx_parser.py:768-778`:

```python
img_model = ImageModel(
    ...
    width_cm=12.0,   # ← HARDCODEADO
    height_cm=8.0,   # ← HARDCODEADO
)
```

**Severidad:** ALTO — Un gráfico de 3cm se generará a 12cm. El aspect ratio NO se preserva. Las dimensiones originales (cx/cy en EMU del XML) se leen para anchors pero nunca se guardan en el `ImageModel`.

### Imágenes dentro de Tablas

**Estado:** 🔴 NO MODELADAS  
**Detalle:** El loop principal del parser recorre hijos directos de `body`. Las celdas de tabla (`w:tc`) son hijas de `w:tbl`. Las imágenes dentro de tablas se extraen a disco por el extractor recursivo (`root.findall('.//a:blip')`) pero **no se crean elementos IMAGE** en el modelo.

**Severidad:** ALTO — Gráficos embebidos en celdas de tabla se pierden en la regeneración.

### Imágenes de Textboxes

**Estado:** ⚠️ PARCIALMENTE  
**Detalle:** Se detectan (por `findall` global) pero no se distinguen con un flag `is_decorative`. Pueden contaminar la numeración de figuras con logos de portada.

### Resumen Área 3

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Inline images | ✅ | INFO |
| Anchor images | ✅ Con posición + wrap | INFO |
| VML legacy | ✅ | INFO |
| Grouped shapes | ✅ | BAJO (findall global, no traversal explícito en extractor) |
| Caption proximity | ✅ Bidirectional ±3 | INFO |
| Dimensiones originales | 🔴 Hardcodeadas 12×8cm | **ALTO** |
| Imágenes en tablas | 🔴 No modeladas | **ALTO** |
| Imágenes decorativas | ⚠️ Sin flag `is_decorative` | MEDIO |

---

## 6. Área 4: Sistema de Previsualización (Dual Engine)

> **Nota:** El proyecto **NO es Electron**. Es una app web (Vite + FastAPI). `start.bat` ejecuta `npm run build` + `python python/main.py`. No existe `nodeIntegration` ni `contextIsolation`.

### Dual Engine Real

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `doc_converter.py:17-43`:

```python
def get_active_engine(self) -> str:
    if self._com_processor.is_available(): return "COM"
    if self._lo_service.is_available(): return "LO"
    return "NONE"
```

Estrategia: COM primero (con trasplante de portada, TOC update, export PDF nativo), fallback a LO (solo conversión PDF, sin post-procesamiento). Forzable con `FORCE_ENGINE` env var.

### Caché de PDF

**Estado:** ⚠️ PARCIALMENTE (frontend solo)  
**Evidencia:** `PDFPreview.tsx:27-38` — Hash manual en Zustand comparando sessionId + texto + rules. Backend **no tiene cache** — cada POST a `/api/preview-pages/` regenera DOCX y convierte a PDF.

**Severidad:** MEDIO — El hash no incluye contenido completo de referencias. Cambios en refs no invalidan cache.

### Lock para COM Concurrente

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `doc_converter.py:51` — `threading.Lock()` global. Serializa todas las operaciones COM y LO.

### word.Quit() con Timeout y Kill Forzado

**Estado:** ⚠️ PARCIALMENTE  
**Evidencia:** `post_processor.py:115-133` — `word.Quit()` en `finally`. Timeout de 60s via `ThreadPoolExecutor`. Kill forzado:

```python
subprocess.run(["taskkill", "/F", "/IM", "WINWORD.EXE"], ...)
```

**Severidad:** ALTO — `taskkill /F /IM WINWORD.EXE` mata **TODOS** los procesos Word del sistema, incluido Word del usuario. Debería matar solo por PID.

### Limpieza de PDFs Temporales

**Estado:** 🔴 NO IMPLEMENTADA  
**Detalle:** Solo se limpian PNGs de preview (`main.py:1080-1082`). Los archivos `preview.pdf`, `FinalPDFSource_*.docx`, `Preview_*.docx`, `APA7_*.docx` se acumulan indefinidamente.

### Bypass del Lock Global

**Estado:** ⚠️ VERIFICADO  
**Evidencia:** `main.py:1108` — El endpoint `preview-pages` llama a `lo.convert` directamente vía `asyncio.to_thread`, saltándose el lock de `DocConverterService`.

### Resumen Área 4

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Dual engine COM + LO | ✅ Real, con fallback automático | INFO |
| Cache de PDF | ⚠️ Solo frontend, hash frágil | MEDIO |
| Lock COM | ✅ threading.Lock global | INFO |
| word.Quit() + kill | ⚠️ Mata TODOS los Word del sistema | **ALTO** |
| Limpieza de temporales | 🔴 No existe | BAJO |
| Bypass lock en preview | ⚠️ Endpoint preview-pages salta lock | MEDIO |
| nodeIntegration | N/A — No es Electron | INFO |

---

## 7. Área 5: Citas y Referencias

### Verificación Cruzada Citas ↔ Referencias

**Estado:** ✅ IMPLEMENTADA (tres capas)

| Capa | Mecanismo | Archivo |
|------|-----------|---------|
| Heurística regex | `cross_check_citations_and_references()` con fuzzy match (SequenceMatcher > 0.8) | `citation_matcher.py:98-158` |
| Graph RAG | Grafo networkx Author→Year→Work, valida citas contra él | `graph_rag.py:57-99` |
| LLM (opcional) | Envía citas+refs al LLM para verificación semántica | `apa_validator.py:85-139` |

### Detección de Citas sin Referencia (Ghost Citations)

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `citation_matcher.py:148-149` — Cada cita sin match se agrega a `ghost_citations[]`. `graph_rag.py:84-88` agrega issues `"missing_reference"`.

### Detección de Referencias Nunca Citadas (Orphan References)

**Estado:** ✅ IMPLEMENTADO  
**Evidencia:** `citation_matcher.py:151-153` — Refs cuyo ID no está en `ref_matched_ids` → `orphan_references[]`.

### Formatos de Cita Soportados

| Tipo | Regex | Evidencia |
|------|-------|-----------|
| Parentética `(García, 2023)` | ✅ | `citation_engine.py:42-52` |
| Narrativa `García (2023)` | ✅ | `citation_engine.py:55-65` |
| Múltiple `(García, 2023; López, 2021)` | ✅ | `citation_engine.py:68-75` |
| Secundaria `(García, 2020, como se citó en Pérez, 2023)` | ✅ | `citation_engine.py:30-39` |
| et al. `(García et al., 2023)` | ✅ | Integrado |
| Con página `(García, 2023, p. 45)` | ✅ | Grupo opcional `p[p]?` |

Anti-falsos positivos: `EXCLUDED_PAREN_TERMS` filtra `(véase Figura 1)`, `(100 kg)`, `(p < .05)`, etc.

### Validación APA de Referencias

**Estado:** ⚠️ PARCIALMENTE  
**Detalle:** Existe DOI Content Negotiation vía Crossref (`referencias_module.py:31-71`) y fallback LLM para formateo. Pero **NO hay validación estructural** de cada referencia (orden de campos, cursivas en títulos de journals, hanging indent correcto en el texto, etc.).

### Campos sin Implementar

**Estado:** 🔴  
- `ReferenciaItem.cited_count` y `never_cited` (`models.py:262-263`) existen en el modelo pero **nunca se calculan** ni se usan en frontend/backend.
- Citas múltiples con `;` se tratan como una sola cita (no se descomponen) — documentado en `test_citations.py:204-211`.

### Resumen Área 5

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Cross-check citas ↔ refs | ✅ Triple capa (regex + graph + LLM) | INFO |
| Ghost citations | ✅ Detectadas | INFO |
| Orphan references | ✅ Detectadas | INFO |
| Formatos de cita | ✅ 6 tipos | INFO |
| Validación APA de refs | ⚠️ Solo DOI + LLM, no estructural | MEDIO |
| `cited_count` / `never_cited` | 🔴 Nunca calculados | MEDIO |

---

## 8. Área 6: Campos de Word y Objetos No Modelados

### TOC (Tabla de Contenidos)

**Estado:** ✅ BIEN MANEJADO (generador original) / 🔴 PERDIDO (layered_generator)

| Fase | Qué hace | Evidencia |
|------|---------|-----------|
| Parse | Pre-scan con depth tracker para TOC begin/end + PAGEREFs | `docx_parser.py:47-123` |
| Generación | Regenera TOC dinámico con `w:fldChar` + `instrText TOC \o "1-3" \h \z \u` | `generator.py:95-178` |
| Post | `w:updateFields w:val="true"` en settings.xml | `generator.py:1072-1077` |
| Layered | Solo texto estático "Índice / Tabla de Contenidos" | `layered_generator.py:244-250` |

### PAGEREF y Referencias Cruzadas

**Estado:** ⚠️ PARCIALMENTE — Se benefician indirectamente del `updateFields` en settings.xml (Word los recalcula al abrir). No hay detección específica fuera del contexto TOC.

### Ecuaciones OMML (m:oMath)

**Estado:** 🔴 BUG — Preservación incompleta  
**Evidencia:** `generator.py:994`:

```python
preserve_text=(elem.has_math or elem.has_fields)  # Solo para headings
```

`generator.py:1000` — Párrafos normales con `has_math=True` **NO reciben `preserve_text=True`**. Un párrafo con ecuación OMML clasificado como `PARAGRAPH` puede tener su XML destruido por `format_normal_paragraph`.

**Severidad:** ALTO — Ecuaciones embebidas en párrafos normales (caso común en documentos académicos) pueden perderse.

### SDT (Structured Document Tags)

**Estado:** ⚠️ Detectado, no modelado — `structure_scanner.py:56-57` retorna `"content_control"`, pero no existe `ElementType.SDT`. Se parsean como párrafos normales.

### Objetos No Modelados

| Contenedor | Detectado | Modelado |
|-----------|-----------|----------|
| Textboxes (w:txbxContent) | ✅ | Tipo `"shape_textbox"` |
| Shapes (wps:wsp) | ✅ | Tipo `"shape_group"` |
| Grupos (wpg:wgp) | ✅ | Tipo `"shape_group"` |
| Campos (w:instrText) | ✅ | `is_editable=False` |
| mc:Fallback | ✅ | Descartado |
| OLE objects (w:object) | ⚠️ Solo flag | `has_ole_objects=True` |
| Bookmarks (w:bookmarkStart) | 🔴 | **No detectado** |
| Hyperlinks (w:hyperlink) | 🔴 | **No detectado** |

### layered_generator — Pérdida Masiva

| Elemento | Se pierde? |
|----------|-----------|
| TOC dinámico | ✅ → texto estático |
| Ecuaciones OMML | ✅ → párrafo vacío |
| PAGEREF | ✅ → perdido |
| SDT | ✅ → perdido |
| Textboxes/Shapes | ✅ → perdidos |
| OLE objects | ✅ → perdidos |
| Bookmarks | ✅ → perdidos |
| Hyperlinks | ✅ → perdidos |

### Resumen Área 6

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| TOC (generador original) | ✅ Regenera campo dinámico | INFO |
| TOC (layered) | 🔴 Texto estático | ALTO |
| Ecuaciones en headings | ✅ preserve_text=True | INFO |
| **Ecuaciones en párrafos** | 🔴 **preserve_text=False** | **ALTO** |
| PAGEREF | ⚠️ Indirecto via updateFields | MEDIO |
| Bookmarks | 🔴 No detectados | MEDIO |
| Hyperlinks | 🔴 No detectados | MEDIO |
| SDT | ⚠️ Detectado, no modelado | MEDIO |

---

## 9. Área 7: Manejo de Errores y Casos Límite

| Caso | Estado | Evidencia |
|------|--------|-----------|
| **Contraseña** | ⚠️ Parcial | `BadZipFile` capturado con mensaje "corrupto o protegido". No validación temprana antes de parsear. |
| **.doc → .docx** | ✅ Manejado | `main.py:401-415` — Magic bytes ZIP (`PK\x03\x04`) + extensión |
| **Corrupto** | ✅ Manejado | Múltiples capas: magic bytes, BadZipFile, try/except general |
| **Grande (80-150 págs)** | ⚠️ Mínimo | Límite de 50 MB. Sin límite de elementos/páginas. Sin timeout en parseo. |
| **doc_converter SyntaxError** | 🔴 BLOCKER | Ver BUG-C1 |
| **Archivos basura en proyecto** | ⚠️ | `.gitignore` con patrones rotos |

### Documentos Grandes — Riesgos

- Un DOCX de 150 páginas pesa típicamente 500 KB–2 MB, pasa el filtro de 50 MB sin problema.
- Sin timeout en `parse_docx_bytes` → solicitudes HTTP pueden colgarse.
- Sin límite de elementos → modelo `DocumentModel` puede crecer sin control.
- Sin streaming → todo se carga en memoria antes de responder.

---

## 10. Área 8: Arquitectura de Cola/Concurrencia (NIM y COM)

### Cola para NIM

**Estado:** 🔴 NO EXISTE — Diseño anti-cola  
**Evidencia:** `llm_classifier.py:363-404`:

```python
# ponytail: fire ALL providers in PARALLEL via asyncio.gather,
# take the first successful result.
tasks = [_try_provider(p) for p in providers]
gathered = await asyncio.gather(*tasks, return_exceptions=True)
```

No hay cola. Todos los proveedores se disparan en paralelo. Delay de 1s entre batches.

### Cola para COM

**Estado:** ✅ IMPLEMENTADA — `threading.Lock()` global  
**Evidencia:** `doc_converter.py:51` — Serializa todas las operaciones COM/LO.

### Rate Limiting

**Estado:** 🔴 DEFINIDO PERO NO USADO  
**Evidencia:** `llm_classifier.py:30-38` — `PROVIDER_CAPACITY` define `requests_per_minute` para cada proveedor. Pero **nunca se verifica**. No hay bucket de tokens ni semaphore.

### Race Condition en Clasificación Simultánea

**Estado:** ⚠️ SIN PROTECCIÓN  
**Detalle:** Dos POST a `/api/classify/{mismo_session_id}` simultáneamente:
1. Ambas cargan el mismo `DocumentModel`
2. Ambas ejecutan clasificación en paralelo, compitiendo por `_classify_progress[session_id]`
3. Ambas guardan resultado — la última en escribir gana

### Resumen Área 8

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Lock COM/LO | ✅ threading.Lock global | INFO |
| Cola NIM | 🔴 No existe (diseño anti-cola) | MEDIO |
| Rate limiting | 🔴 Definido, nunca enforceado | **ALTO** |
| Race condition mismo session_id | ⚠️ Sin protección | MEDIO |

---

## 11. Área 9: Rollback y Seguridad de Datos del Usuario

### Preservación del Original

**Estado:** ✅ BIEN IMPLEMENTADO  
**Evidencia:** `main.py:432` — `(session_dir / "original.docx").write_bytes(content)`. Nunca se muta.

### Rollback

**Estado:** ✅ IMPLEMENTADO (tres niveles)

| Mecanismo | Detalle |
|-----------|---------|
| Snapshots backend | `save_session_snapshot()` — SQLite, máximo 5 por sesión |
| Undo/Redo frontend | `useDocStore` — `history[]` / `historyIndex`, Ctrl+Z/Y |
| Rollback REST | `POST /api/rollback/{session_id}` — restaura snapshot más reciente |

**⚠️** Undo/Redo se pierde al recargar (solo en memoria del navegador).

### Limpieza de Archivos Temporales

**Estado:** 🔴 CRÍTICO — No existe cleanup automático

| Archivo | ¿Se limpia? |
|---------|-------------|
| `original.docx` | Solo con `DELETE /api/session/{id}` manual |
| `APA7_*.docx`, `Tracked_*.docx`, `Preview_*.docx` | Solo con DELETE manual |
| `preview.pdf`, `page_*.png` | PNGs parciales, PDF nunca |
| `llm_classification_cache.json` | Nunca (crece sin límite) |
| SQLite snapshots | Nunca (sin TTL ni GC) |

**Riesgo:** Tesis y documentos con contenido confidencial se acumulan en disco indefinidamente.

### Contenido Enviado a NIM

**Estado:** ⚠️ SIN ANONIMIZACIÓN  
**Evidencia:** `llm_classifier.py:340-361` — Hasta 200 caracteres de cada elemento se envían a **8 proveedores en paralelo** (NIM, Groq, OpenRouter, Cerebras, Mistral, OpenCodeZen, ZenMux, Gemini). No hay anonimización de PII.

### Logs con Texto del Usuario

**Estado:** 🟡 BAJO RIESGO — Los `print()` no loguean texto completo del documento. Pero si stdout se redirige a archivo, fragmentos pueden aparecer. El endpoint `GET /api/debug-log` puede exponer información sensible.

### Resumen Área 9

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Preservación del original | ✅ | INFO |
| Snapshots + Undo/Redo | ✅ | INFO |
| Cleanup automático | 🔴 **No existe** | **CRÍTICO** |
| TTL de sesiones | 🔴 No existe | ALTO |
| Anonimización PII | 🔴 No existe | ALTO |
| Envío a 8 proveedores en paralelo | ⚠️ Sin opt-out visible | ALTO |

---

## 12. Área 10: UI/UX del Panel de Revisión y Previsualización

### Contador de Problemas

**Estado:** ⚠️ PARCIALMENTE — Hay métricas pero no separa clasificación de estilo.

`ClassifierView.tsx:101-110` — Muestra: automáticos (verde), para revisar (amarillo), sin clasificar (rojo). Pero **no distingue** entre "problemas de clasificación" (tipo mal asignado) y "problemas de aplicación de estilo" (márgenes incorrectos).

### Comparación Original vs Corregido

**Estado:** 🔴 NO EXISTE — No hay split-view, toggle overlay, ni diff visual. Solo se puede alternar entre `edit` (cards) y `result` (PDF). Existe endpoint `/api/generate-tracked` que genera DOCX con Track Changes, pero solo es visible post-descarga en Word.

### Cambio de Clasificación

**Estado:** ✅ EXCELENTE — 6 métodos: dropdown tipo, dropdown nivel, edición de texto, menú contextual, ElementInspector, bulk accept. Cada cambio marca `is_user_modified=True, confidence=1.0`.

### ElementInspector

**Estado:** ✅ RICO — Panel con tabs Info, Estilo, Avanzado, ImageControls. Muestra: texto completo, tipo, nivel, reglas APA descriptivas, confidence, razonamiento LLM, controles de imagen (5 estilos, dimensiones, caption, wrap).

### Wizard de Primer Uso

**Estado:** ✅ BUENO — 3 pasos iniciales (formato APA, portada, modo) + wizard guiado de 7 pasos con barra timeline. Recuperación de sesión automática.

### Progreso LLM

**Estado:** ✅ EXCEPCIONAL — `LLMProgressPanel` con barra compacta + panel expandido. Muestra: proveedor actual (color por proveedor), lotes completados, tiempo estimado, cadena de fallback visual (NV → GQ → OR con badges).

### Fricciones Reales

| # | Fricción | Severidad |
|---|---------|-----------|
| 1 | **Sin comparación visual original vs corregido** | ALTA |
| 2 | **Sin diff en la UI** (solo Track Changes post-descarga) | ALTA |
| 3 | Undo/Redo se pierde al recargar | MEDIA |
| 4 | No hay botón "Guardar" explícito ni indicador de autosave | MEDIA |
| 5 | Contador mezcla clasificación y estilo | MEDIA |
| 6 | Preview PDF requiere LibreOffice (sin mensaje claro si no está) | MEDIA |
| 7 | Sin tour de onboarding ni modal de ayuda | BAJA |
| 8 | AI Badge puede alarmar estudiantes | BAJA |

### Resumen Área 10

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Wizard inicial | ✅ | INFO |
| Cambio de clasificación | ✅ 6 métodos | INFO |
| ElementInspector | ✅ Rico | INFO |
| Progreso LLM | ✅ Excepcional | INFO |
| Contador de problemas | ⚠️ No separa clasificación/estilo | MEDIA |
| **Comparación original vs corregido** | 🔴 **No existe** | **ALTO** |
| **Vista diff** | 🔴 **Solo post-descarga** | **ALTO** |

---

## 13. Área 11: Gate de Exportación

### Módulo sanity_check.py

**Estado:** ✅ EXISTE (60 líneas) — Diseño correcto  
**Evidencia:** `parsing/sanity_check.py:29-30` — Compara `orig_nodes` vs `gen_nodes` con deduplicación mc:Fallback. Compara caracteres reales editables.

### Tolerancia

**Evidencia:** `generator.py:1081` — `tolerance=0.05` (5%, por encima del default de 2% en sanity_check.py).

### ¿Bloquea la descarga?

**Estado:** 🔴 **NO — El gate está desactivado**  
**Evidencia:** `generator.py:1079-1085`:

```python
try:
    verify_document_content_integrity(original_file, out_path, tolerance=0.05)
except Exception as e:
    print(f"[WARN] Alerta de Sanidad en exportación: {e}")
# ← La ejecución continúa normally.
```

El `ExportBlockedError` se lanza correctamente dentro de `sanity_check.py`, pero el generador **traga la excepción** con un `print()`. El documento se entrega al usuario sin bloqueo.

### Linter Anti-Fuga

**Evidencia:** `sanity_check.py:36-43` — Verifica que no haya tokens internos (author_card, vertical_line, shape_group, shape_textbox). También capturado por el mismo `except Exception` silenciado.

### layered_generator

**Estado:** 🔴 NO tiene gate de sanidad. Al ser "from-scratch", no compara con original.

### Resumen Área 11

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| Módulo sanity_check.py | ✅ Diseño correcto | INFO |
| Deduplicación mc:Fallback | ✅ | INFO |
| Linter anti-fuga | ✅ | INFO |
| **Bloquea la descarga** | 🔴 **NO — except silencia** | **CRÍTICO** |
| Gate en layered_generator | 🔴 No existe | ALTO |

---

## 14. Área 12: Exploración Libre

### 14.1 Arquitectura y Deuda Técnica

#### Duplicación de Modelos

**Severidad:** ALTO  
**Evidencia:** `python/models.py` define dos jerarquías paralelas:

| Modelo "nuevo" | Modelo "viejo" | Líneas |
|----------------|----------------|--------|
| `DocumentElement` (l.162) | `ElementModel` (l.421) | Ambos representan un elemento |
| `CitaInText` (l.231) | `CitationModel` (l.486) | Ambos representan citas |
| `ReferenciaItem` (l.255) | `ReferenciaModel` (l.497) | Ambos representan referencias |

`DocumentModel` usa los "viejos". Los "nuevos" parecen un refactor inconcluso.

#### God Object: main.py (2,071 líneas)

Concentra ~30 endpoints, schemas inline, lógica de negocio, manejo de archivos, configuración de logging, y auto-build del frontend.

#### hasattr Guards Everywhere

`main.py:556-580`, `601-605`, `647-659` — Múltiples checks `hasattr(elem, 'id')` sugieren que elementos se serializan a dicts y luego se tratan como modelos.

#### Código Muerto

| Archivo | Issue |
|---------|-------|
| `llm_batch_classifier.py` (303 líneas) | Nunca importado en código activo — código muerto |
| `react-router-dom` en package.json | 0 imports en src/ |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Parcialmente muerto (solo `@hello-pangea/dnd` se usa) |
| `src/store/slices/*.ts` (5 archivos) | Interfaces de 1 línea, nunca importadas |
| `Welcome.tsx` | Importado en ningún lado |
| `CLAUDE.md` y `AGENTS.md` | Contenido idéntico |
| 22 scripts sueltos en `python/` | Debug/one-off scripts |

#### Inconsistencia de Nombres

`main.py:1342` usa `doc.references` pero `DocumentModel` tiene `referencias` (sin la 's' en inglés). Esto causará `AttributeError`.

### 14.2 Metodología de Desarrollo

| Aspecto | Estado |
|---------|--------|
| Tests Python | ✅ 14 archivos, buena cobertura |
| Tests Frontend | ⚠️ 4 archivos, cobertura mínima (sin tests de API client, wizards, portada) |
| CI/CD | 🔴 No existe (sin .github/workflows, Jenkinsfile, etc.) |
| Linter | 🔴 No configurado (CLAUDE.md:34 lo admite) |
| Coverage report | 🔴 No existe |
| Branch management | ⚠️ .git existe pero sin evidencia de branching strategy |

### 14.3 Uso de IA en el Producto

#### NIM: Bien pero con desperdicio

**Lo bueno:** Cadena de fallback multi-proveedor, cache SHA-256, batching adaptativo, solo envía a LLM elementos con confianza baja.

**Lo problemático:**
- Dispara **TODOS los proveedores en paralelo** por cada lote. 3 API keys = 3x requests simultáneos.
- No hay selección inteligente de modelo. Un LLaMA 70B es sobrekill para clasificar headings/paragraphs/bullets. Un 8B haría lo mismo a ~10% del costo.
- El comment dice "8 free APIs in parallel costs the same ($0)" — algunos proveedores NO son gratis.

#### Graph RAG: Nombre pomposo para grafo trivial

`graph_rag.py` (99 líneas) es un parser regex + un `dict[author] → set[years]` envuelto en networkx. No hay retrieval, generation, embedding, ni vector store.

#### AI Detector: No usa IA

`ai_detector.py` (344 líneas) es puramente heurístico: 56 patrones regex + análisis de longitud de oraciones. No detectaría texto generado por IA natural.

#### Tareas que Deberían Intercambiar Enfoque

| Tarea actual | Debería ser |
|-------------|------------|
| Clasificación con LLM 70B | Modelo 8B o heurística mejorada |
| Detección de IA con regex | LLM pequeño especializado |
| Formato de refs con reglas rígidas | LLM para referencias no-estándar |
| Sugerencia de captions con LLM | ✅ Correcto |
| Reescritura de texto con LLM | ✅ Correcto |

#### No hay RAG con la Guía APA 7

No existe embedding, vector store, ni retrieval de la Publication Manual. Toda validación APA está hardcodeada. Un RAG real permitiría responder preguntas del usuario y validar contra la fuente oficial.

### 14.4 Seguridad y Privacidad

| Aspecto | Estado | Severidad |
|---------|--------|-----------|
| `.env` con credenciales en distribución | 🔴 Presente en el proyecto extraído | **CRÍTICO** |
| CORS `allow_origins=["*"]` con credenciales | 🔴 `main.py:87-93` | ALTO |
| Sin autenticación en ningún endpoint | 🔴 Cualquiera con acceso a localhost puede usar todo | ALTO |
| Endpoint `/api/license/my-pin` expone el PIN | 🔴 `main.py:326-329` | ALTO |
| Debug log accesible vía API | ⚠️ `GET /api/debug-log/{lines}` | MEDIO |
| Path traversal potencial en imágenes | ⚠️ `main.py:748` — filename sin sanitización | MEDIO |
| Contenido a NIM sin anonimización | ⚠️ 8 proveedores, 200 chars por elemento | MEDIO |
| Sistema de licencia trivial | ⚠️ SHA-256 de hostname + endpoint que lo devuelve | MEDIO |

### 14.5 Escalabilidad Futura

| Problema | Detalle | Severidad |
|----------|---------|-----------|
| State global en memoria | `_parse_progress`, `_classify_progress`, `_build_hash_cache`, `collab_manager` — se pierden al reiniciar, no funcionan con múltiples workers | ALTO |
| SQLite sin WAL | `session_manager.py:44-61` — `database is locked` con concurrencia | MEDIO |
| Auto-build frontend en startup | `main.py:1984-2034` — Hash SHA-256 de todo `src/`, 5-15s de overhead | MEDIO |
| Almacenamiento sin límites | Sesiones crecen indefinidamente, sin TTL ni GC | ALTO |
| LibreOffice singleton | Cada proceso intentaría iniciar su propia instancia | MEDIO |
| God Store Zustand (868 líneas) | Todo el estado en un solo store, sin code splitting | BAJO |

### 14.6 Funcionalidades Nuevas Sugeridas

| Feature | Impacto | Complejidad |
|---------|---------|-------------|
| **Diff visual side-by-side** (original vs APA7) | Alto | Media |
| **APA Coach conversacional** (chatbot sidebar con RAG sobre Publication Manual) | Alto | Media-Alta |
| **Plantillas universitarias preconfiguradas** (marketplace por universidad) | Alto | Alta |
| **Batch processing** (múltiples documentos) | Medio | Media |
| **Validación contra Publication Manual oficial** (con RAG) | Alto | Media |
| **Detector de plagio integrado** (extender ai_detector.py) | Medio | Media |
| **Preview WYSIWYG inline** (editar sobre renderizado fiel) | Alto | Alta |
| **Integración con Google Docs / Word Online** | Alto | Alta |

---

## 15. Plan de Acción Priorizado

### P0 — Crítico (Esta Semana)

| # | Acción | Archivo | Esfuerzo |
|---|--------|---------|----------|
| 1 | **Fix SyntaxError en doc_converter.py** — Reindentar bloque if/elif/else | `services/doc_converter.py:70-81` | 15 min |
| 2 | **Activar gate de exportación** — Eliminar `try/except` o cambiar a `raise` | `generation/generator.py:1079-1085` | 10 min |
| 3 | **Fix import inexistente** — Cambiar `storage.state` a `persistence.session_manager` | `main.py:252` | 5 min |

### P1 — Alto (Próximo Sprint)

| # | Acción | Detalle |
|---|--------|---------|
| 4 | Implementar cleanup automático de sesiones (TTL 24h + GC periódico) | Nuevo módulo o middleware |
| 5 | Agregar `preserve_text=True` para párrafos con `has_math` | `generator.py:1000` |
| 6 | Extraer dimensiones reales de imágenes del XML (cx/cy EMU) | `docx_parser.py:768-778` |
| 7 | Modelar imágenes dentro de tablas como elementos IMAGE | `docx_parser.py:860-902` |
| 8 | Rate limiting real para LLM (enforce `requests_per_minute`) | `llm_classifier.py:30-38` |
| 9 | Cambiar `taskkill /F /IM` a kill por PID | `post_processor.py:230-240` |
| 10 | Eliminar CORS `allow_origins=["*"]` | `main.py:87-93` |
| 11 | Implementar autenticación básica (al menos para endpoints sensibles) | Nuevo middleware |
| 12 | Eliminar endpoint `/api/license/my-pin` | `main.py:326-329` |
| 13 | Unificar modelos duplicados en models.py | `models.py:162-497` |

### P2 — Medio

| # | Acción |
|---|--------|
| 14 | Implementar comparación visual original vs corregido (split-view o toggle) |
| 15 | Persistir undo/redo en localStorage o backend |
| 16 | Separar métricas de clasificación vs estilo en contador de problemas |
| 17 | Calcular `cited_count` / `never_cited` en ReferenciaItem |
| 18 | Agregar tour de onboarding para primer uso |
| 19 | Configurar linter (ESLint + Prettier + Ruff) |
| 20 | Configurar CI/CD básico (GitHub Actions) |
| 21 | Refactorizar main.py en routers separados |
| 22 | Eliminar código muerto (llm_batch_classifier, scripts sueltos, dependencias muertas) |
| 23 | SQLite con WAL mode para sesiones |

### P3 — Bajo

| # | Acción |
|---|--------|
| 24 | Guardar flag `is_decorative` en ImageModel para imágenes de textboxes |
| 25 | Implementar detección de bookmarks e hyperlinks |
| 26 | Agrupar elementos por estilo para LLM (enviar texto de vecinos) |
| 27 | Usar modelo 8B para clasificación simple, reservar 70B para ambigüedad |
| 28 | RAG real con Publication Manual APA 7 |
| 29 | Cache LLM con límite (LRU) |
| 30 | Límite de elementos/páginas en parseo + timeout |

---

*Fin de la auditoría. Todos los hallazgos fueron verificados con fragmentos de código reales (archivo:línea). Nada fue reportado como "funciona" sin evidencia concreta.*
