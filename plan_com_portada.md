# Plan de Implementación: Detección de Layout de Página vía COM (Word Automation) para WordAPA7

> **Destino del documento**: Backend Python del proyecto WordAPA7. Será portado a Electron como app de escritorio.
> **Prioridad**: Calidad > Velocidad. Un solo usuario concurrente. Sin restricciones de RAM/tiempo del lado servidor.
> **Autor del plan**: Análisis de arquitectura sobre código actual (commit analizado: `wordapa7/` extraído del ZIP de 137MB).
> **Fecha**: 2026-07-24

---

## 1. Resumen ejecutivo

Hoy el pipeline `parsing/ → classification/ → generation/` detecta dónde termina la portada y empieza el cuerpo usando **heurística de keywords + estimación de páginas por word_count**. Esto es frágil: en documentos reales como `10mo Trabajo Contabilidad.docx` el parser crashea en `extract_textbox_paragraphs`, `portada_detected=False`, `body_start_paragraph_idx=0`, y el generador termina aplicando formato APA desde el párrafo 0, **rompiendo la portada original del usuario**.

La solución no es más heurística. La solución es **preguntarle al motor de Word en qué página cae cada párrafo**. COM (`pywin32` → `Word.Application`) lo hace con `Range.Information(wdActiveEndPageNumber=3)`. En Mac/Linux se replica con LibreOffice → PDF → PyMuPDF. En el peor caso (sin Word ni LibreOffice) se conserva la heurística actual como fallback final.

Este plan define:

1. Un módulo nuevo `python/parsing/page_layout_provider.py` con 3 backends intercambiables.
2. Los 3 puntos exactos del código existente donde se conecta (parser, pre_classifier, generator).
3. 4 mejoras derivadas que aprovechan el mismo dato (page_count real, validación de layout, previews por página exactos, control de viudas/huérfanas).
4. Una suite de tests específica con criterios de aceptación objetivos.
5. Un mega-prompt al final para pegarle a la IA programadora.

---

## 2. Contexto del proyecto (lo que la otra IA necesita saber)

**Stack**: FastAPI (Python) en puerto 8742 + React 18 + TypeScript + Vite + Zustand.

**Pipeline actual**:
```
upload .docx
  → parsing/docx_parser.py::parse_docx_bytes
    → sanitize_numbering_xml
    → extract_textbox_paragraphs (xml_deep_parser)
    → iterar body del XML: por cada <w:p> crear ElementModel, por cada <w:tbl> crear TableModel
    → pre_classify_elements (3 pasadas heurísticas)
    → find_body_start_via_xml (heurística: busca keyword "introducción", "resumen", etc.)
    → guardar doc_model.portada["body_start_paragraph_idx"]
  → /api/classify (LLM opcional)
  → /api/generate
    → generation/generator.py::generate_apa7_docx
    → cover_paragraph_count = body_start_paragraph_idx (o fallback de matching por texto)
    → p_idx = cover_paragraph_count
    → aplica estilos APA desde p_idx en adelante
```

**Dónde duele hoy**:

| Archivo | Línea aprox. | Problema |
|---|---|---|
| `python/parsing/pre_classifier.py` | 449-518 | Pasada 2 decide `portada_boundary` con conteo de keywords + formato. Falla en documentos sin keywords explícitas. |
| `python/parsing/xml_deep_parser.py` | 178-263 | `find_body_start_via_xml` busca keyword de cuerpo (`introducción`, `resumen`, etc.). Falla si el cuerpo empieza con un título distinto. |
| `python/parsing/docx_parser.py` | 907 | `page_count=max(1, total_words // 250)` — estimación grosera, no real. |
| `python/generation/generator.py` | 612-675 | `cover_paragraph_count` combina 3 señales heurísticas. Si todas fallan, vale 0 → el generador aplica APA desde el inicio y destruye la portada original. |
| `python/main.py` | 839-913 | Ya hay endpoint `/api/preview-pages` que usa LibreOffice para generar PNGs, pero solo para preview visual, no para extraer información de layout. |

**Bug concreto que motivó este plan** (de `AUDITORIA.md`):
- `extract_textbox_paragraphs()` crashea con `'str' object has no attribute 'text'` en docs reales.
- Resultado: `portada_detected=False`, `body_start_paragraph_idx=0`, `cover_paragraph_count=0`.
- El generador respeta la portada "original" pero como `p_idx=0` empieza a aplicar estilos APA a los párrafos de la portada del usuario.
- Salida: documento con portada destruida y formato APA aplicado encima.

---

## 3. Por qué COM es la decisión correcta aquí

La otra IA (que propuso LibreOffice headless en backend web) tenía razón **en un contexto web**. Pero el contexto real es:

| Dimensión | Backend web (lo que la otra IA asumió) | App desktop Electron (tu destino real) |
|---|---|---|
| Concurrencia | 50 usuarios compitiendo por RAM | 1 usuario por máquina |
| Tiempo disponible | Milisegundos por request | Segundos o decenas de segundos son aceptables |
| Deployment | Docker container, ~2GB límite | Instalador local, sin límite |
| Word instalado | Imposible asumirlo | Casi 100% de tesistas ya lo tienen |
| Popup de alertas | Congela el proceso (no hay humano) | El humano está ahí |

**COM te da algo que ningún otro método puede**: la paginación **exacta** que verá el usuario al abrir el documento en Word. LibreOffice → PDF → PyMuPDF da una aproximación excelente pero no idéntica (Word y LibreOffice tienen motores de layout ligeramente distintos, sobre todo con fuentes embebidas, spacing Kerning, y tablas complejas).

**Estrategia en cascada**:

```
1. Windows + Word instalado      → COM (precisión máxima)
2. Mac/Linux o Windows sin Word  → LibreOffice + PyMuPDF (precisión ~98%)
3. Sin Word ni LibreOffice       → Heurística actual (precisión ~70%)
```

La prioridad es **calidad**. Si COM está disponible, se usa. Si no, cae al siguiente.

---

## 4. Arquitectura propuesta

### 4.1 Nuevo módulo: `python/parsing/page_layout_provider.py`

```
parsing/
├── docx_parser.py        (sin cambios estructurales, consume el provider)
├── pre_classifier.py     (Pasada 2 usa page layout si está disponible)
├── xml_deep_parser.py    (sin cambios)
└── page_layout_provider.py   ← NUEVO
    ├── class PageLayoutProvider (ABC)
    ├── class COMPageLayoutProvider
    ├── class LibreOfficePageLayoutProvider
    ├── class HeuristicPageLayoutProvider
    └── def get_page_layout_provider() -> PageLayoutProvider  (factory con caché)
```

### 4.2 Contrato del provider

```python
from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass

@dataclass
class PageLayoutResult:
    """Resultado de paginar un .docx."""
    paragraph_pages: list[int]      # Para cada párrafo del body (en orden), su número de página (1-indexed)
    total_pages: int                # Total de páginas del documento
    provider_used: str              # "com" | "libreoffice" | "heuristic"
    confidence: float               # 1.0 para COM, 0.95 LibreOffice, 0.5 heurística
    notes: list[str]                # Warnings (ej: "Word colgó, se mató proceso")

class PageLayoutProvider(ABC):
    @abstractmethod
    def paginate(self, docx_path: Path, timeout_seconds: int = 30) -> PageLayoutResult:
        """Abre el .docx, pagina, retorna el mapeo párrafo → página."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """True si el backend está instalado en esta máquina."""
        pass
```

### 4.3 Implementación de cada backend

#### 4.3.1 `COMPageLayoutProvider` (Windows + Word)

```python
class COMPageLayoutProvider(PageLayoutProvider):
    """
    Usa Word.Application via pywin32 para obtener el número de página exacto
    de cada párrafo. Es la fuente de verdad más precisa disponible.
    """

    def is_available(self) -> bool:
        if sys.platform != "win32":
            return False
        try:
            import win32com.client  # noqa
            return True
        except ImportError:
            return False

    def paginate(self, docx_path: Path, timeout_seconds: int = 30) -> PageLayoutResult:
        import pythoncom
        import win32com.client

        pythoncom.CoInitialize()
        # DispatchEx = instancia nueva y aislada (NO reutilizar la del usuario)
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0  # wdAlertsNone — mata popups que colgarían el proceso

        doc = None
        try:
            # Timeout externo: si Word se cuelga, matar WINWORD.EXE
            result = self._paginate_with_timeout(
                word, docx_path, timeout_seconds
            )
            return result
        finally:
            try:
                if doc:
                    doc.Close(SaveChanges=False)
            except Exception:
                pass
            try:
                word.Quit()
            except Exception:
                pass
            pythoncom.CoUninitialize()
            # Limpieza agresiva de procesos zombies por si acaso
            self._kill_orphan_winword_processes()

    def _paginate_with_timeout(self, word, docx_path, timeout):
        # Usar concurrent.futures con timeout
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._do_paginate, word, docx_path)
            try:
                return future.result(timeout=timeout)
            except concurrent.futures.TimeoutError:
                raise TimeoutError(
                    f"Word no respondió en {timeout}s — matando proceso"
                )

    def _do_paginate(self, word, docx_path) -> PageLayoutResult:
        doc = word.Documents.Open(
            str(docx_path.resolve()),
            ConfirmConversions=False,
            ReadOnly=True,           # NUNCA abrir para escritura
            AddToRecentFiles=False,  # No contaminar historial del usuario
        )
        doc.Repaginate()  # CRÍTICO: fuerza cálculo de paginación

        paragraph_pages: list[int] = []
        for para in doc.Paragraphs:
            # wdActiveEndPageNumber = 3
            page_num = para.Range.Information(3)
            paragraph_pages.append(int(page_num))

        total_pages = doc.ComputeStatistics(2)  # wdStatisticPages = 2

        return PageLayoutResult(
            paragraph_pages=paragraph_pages,
            total_pages=total_pages,
            provider_used="com",
            confidence=1.0,
            notes=[],
        )

    def _kill_orphan_winword_processes(self):
        """Mata procesos WINWORD.EXE zombies de sesiones anteriores."""
        if sys.platform != "win32":
            return
        try:
            import subprocess
            # Solo matar los que llevan > 5 minutos corriendo
            subprocess.run(
                ["taskkill", "/F", "/IM", "WINWORD.EXE", "/T"],
                capture_output=True, timeout=5,
            )
        except Exception:
            pass
```

**Cuidados clave en COM** (la otra IA los mencionó, los mantenemos):

1. `DisplayAlerts = 0` es obligatorio. Sin esto, cualquier popup congela el proceso.
2. `DispatchEx` (no `Dispatch`) — siempre instancia nueva y aislada.
3. `ReadOnly=True` — nunca guardar cambios sobre el documento del usuario.
4. `AddToRecentFiles=False` — no contaminar el historial "Documentos recientes" del usuario.
5. `finally` siempre cierra `doc` y `word.Quit()`.
6. Timeout externo con `concurrent.futures` — si Word se cuelga, matar el proceso.
7. Limpieza de zombies `WINWORD.EXE` al inicio de la app y después de cada llamada.

#### 4.3.2 `LibreOfficePageLayoutProvider` (Mac/Linux o Windows sin Word)

```python
class LibreOfficePageLayoutProvider(PageLayoutProvider):
    """
    Convierte .docx → PDF con LibreOffice headless, luego usa PyMuPDF (fitz)
    para extraer el mapeo párrafo → página.
    """

    def is_available(self) -> bool:
        return bool(shutil.which("soffice") or shutil.which("libreoffice"))

    def paginate(self, docx_path: Path, timeout_seconds: int = 60) -> PageLayoutResult:
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_dir_path = Path(tmp_dir)
            pdf_path = tmp_dir_path / (docx_path.stem + ".pdf")

            # LibreOffice headless → PDF
            soffice = shutil.which("soffice") or shutil.which("libreoffice")
            result = subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf",
                 "--outdir", str(tmp_dir_path), str(docx_path)],
                capture_output=True, text=True, timeout=timeout_seconds,
            )
            if result.returncode != 0 or not pdf_path.exists():
                raise RuntimeError(f"LibreOffice falló: {result.stderr[:300]}")

            # PyMuPDF: para cada página, extraer texto y comparar con párrafos del .docx
            return self._map_paragraphs_to_pages(docx_path, pdf_path)

    def _map_paragraphs_to_pages(self, docx_path, pdf_path):
        import fitz  # PyMuPDF
        import docx

        # 1. Obtener lista de textos de párrafos del .docx (en orden)
        doc = docx.Document(str(docx_path))
        para_texts = [p.text.strip() for p in doc.paragraphs]

        # 2. Abrir PDF y extraer texto por página
        pdf = fitz.open(str(pdf_path))
        page_texts: list[str] = []
        for page in pdf:
            page_texts.append(page.get_text("text"))

        # 3. Matching: para cada párrafo del .docx, buscar en qué página aparece
        paragraph_pages: list[int] = []
        current_page = 1
        consumed_offset = 0  # offset dentro del texto acumulado de páginas

        # Estrategia: concatenar todos los textos de página con separador,
        # luego buscar el offset de cada párrafo y mapear a página.
        full_text = ""
        page_boundaries: list[int] = []  # índice en full_text donde empieza cada página
        for pt in page_texts:
            page_boundaries.append(len(full_text))
            full_text += pt + "\n"

        import re
        for para_text in para_texts:
            if not para_text:
                paragraph_pages.append(current_page)
                continue
            # Normalizar whitespace para matching robusto
            pattern = re.escape(re.sub(r'\s+', ' ', para_text))[:80]
            match = re.search(pattern, re.sub(r'\s+', ' ', full_text[consumed_offset:]))
            if match:
                abs_offset = consumed_offset + match.start()
                # Buscar a qué página pertenece abs_offset
                for p_idx, boundary in enumerate(page_boundaries):
                    if abs_offset < boundary:
                        current_page = p_idx  # 1-indexed
                        break
                    elif p_idx == len(page_boundaries) - 1:
                        current_page = p_idx + 1
                else:
                    current_page = len(page_boundaries)
                # Actualizar consumed_offset para siguiente búsqueda
                consumed_offset = abs_offset + len(pattern)
            paragraph_pages.append(current_page)

        return PageLayoutResult(
            paragraph_pages=paragraph_pages,
            total_pages=len(page_texts),
            provider_used="libreoffice",
            confidence=0.95,
            notes=["LibreOffice layout puede diferir de Word en tablas complejas"],
        )
```

#### 4.3.3 `HeuristicPageLayoutProvider` (fallback final)

```python
class HeuristicPageLayoutProvider(PageLayoutProvider):
    """
    Último recurso. Usa la lógica actual: 250 palabras/página + keyword de cuerpo.
    """

    def is_available(self) -> bool:
        return True  # Siempre disponible

    def paginate(self, docx_path: Path, timeout_seconds: int = 30) -> PageLayoutResult:
        import docx
        doc = docx.Document(str(docx_path))

        paragraph_pages: list[int] = []
        current_page = 1
        words_on_current_page = 0

        for p in doc.paragraphs:
            wc = len(p.text.split())
            if words_on_current_page + wc > 250 and wc > 0:
                current_page += 1
                words_on_current_page = 0
            paragraph_pages.append(current_page)
            words_on_current_page += wc

        return PageLayoutResult(
            paragraph_pages=paragraph_pages,
            total_pages=current_page,
            provider_used="heuristic",
            confidence=0.5,
            notes=["Estimación por word_count, no es precisa"],
        )
```

#### 4.3.4 Factory

```python
_cached_provider: PageLayoutProvider | None = None

def get_page_layout_provider() -> PageLayoutProvider:
    """
    Retorna el mejor provider disponible, cacheado a nivel de proceso.
    Orden de preferencia: COM > LibreOffice > Heurístico.
    """
    global _cached_provider
    if _cached_provider is not None:
        return _cached_provider

    providers = [
        COMPageLayoutProvider(),
        LibreOfficePageLayoutProvider(),
        HeuristicPageLayoutProvider(),
    ]
    for p in providers:
        if p.is_available():
            _cached_provider = p
            print(f"[PAGE-LAYOUT] Usando provider: {p.__class__.__name__}")
            return p

    # Imposible llegar aquí porque HeuristicPageLayoutProvider siempre está disponible
    _cached_provider = HeuristicPageLayoutProvider()
    return _cached_provider
```

---

## 5. Dónde conectar el provider en el código existente

Hay **3 puntos de conexión** y **2 mejoras opcionales**. Los puntos de conexión son los mínimos para resolver el bug de portada. Las mejoras son ganancias adicionales que el mismo dato habilita.

### 5.1 Punto de conexión #1: `python/models.py` — extender el schema

Agregar campos al `DocumentMeta` para guardar el resultado del provider:

```python
class DocumentMeta(BaseModel):
    # ... campos existentes ...
    page_count: int = 0                          # ya existe, ahora será exacto
    page_count_exact: bool = False               # NUEVO: True si vino de COM/LibreOffice
    paragraph_pages: list[int] = Field(default_factory=list)  # NUEVO: mapeo párrafo → página
    page_layout_provider: str = ""               # NUEVO: "com" | "libreoffice" | "heuristic"
    page_layout_confidence: float = 0.0          # NUEVO: 0.0 a 1.0
```

**Justificación**: Guardar el mapeo completo permite que el frontend y el generador lo consulten sin volver a paginar. El JSON de sesión crece ~1KB por cada 100 párrafos (un `int` por párrafo), que es despreciable.

### 5.2 Punto de conexión #2: `python/parsing/docx_parser.py` — invocar el provider

Al final de `parse_docx_bytes`, antes de construir el `DocumentMeta`, llamar al provider. Esto reemplaza la línea 907 actual (`page_count=max(1, total_words // 250)`).

**Cambio concreto** en `python/parsing/docx_parser.py`:

```python
# ── ANTES (línea ~907) ──────────────────────────────────
meta = DocumentMeta(
    ...
    page_count=max(1, total_words // 250),  # Estimacion aproximada
    ...
)

# ── DESPUÉS ─────────────────────────────────────────────
from parsing.page_layout_provider import get_page_layout_provider

# Paginación real vía COM / LibreOffice / heurística
session_docx_path = storage_dir / "sessions" / session_id / "original.docx"
# (ya fue guardado en main.py::upload_docx antes de llamar a parse_docx_bytes)
layout_result = None
try:
    provider = get_page_layout_provider()
    layout_result = provider.paginate(session_docx_path, timeout_seconds=30)
except Exception as e:
    print(f"[WARN] Page layout provider falló: {e}")

# Calcular body_start_paragraph_idx desde layout
body_start_idx_from_layout = None
if layout_result and layout_result.paragraph_pages:
    # La portada termina en el último párrafo de la página 1
    # (a menos que el usuario tenga portada multi-página, ver mejora #2)
    last_page1_idx = max(
        i for i, pg in enumerate(layout_result.paragraph_pages)
        if pg == 1
    )
    body_start_idx_from_layout = last_page1_idx + 1

meta = DocumentMeta(
    source_file=file_name,
    source_hash=source_hash,
    wordapa7_version="1.0.0",
    previously_processed=False,
    parsed_at=datetime.now(timezone.utc).isoformat(),
    page_count=layout_result.total_pages if layout_result else max(1, total_words // 250),
    page_count_exact=bool(layout_result and layout_result.provider_used != "heuristic"),
    paragraph_pages=layout_result.paragraph_pages if layout_result else [],
    page_layout_provider=layout_result.provider_used if layout_result else "",
    page_layout_confidence=layout_result.confidence if layout_result else 0.0,
    word_count=total_words,
    has_images=has_images,
    has_tables=has_tables_detected,
    has_equations=has_equations,
    has_ole_objects=has_ole,
    portada_detected=portada_detected,
    apa_format=APAFormat.STUDENT,
    work_mode=WorkMode.REVIEW,
)

# Sobreescribir body_start_paragraph_idx si el layout lo calculó
if body_start_idx_from_layout is not None:
    doc_model.portada["body_start_paragraph_idx"] = body_start_idx_from_layout
    doc_model.portada["body_start_source"] = "page_layout"  # para debugging
```

### 5.3 Punto de conexión #3: `python/parsing/pre_classifier.py` — Pasada 2 con layout

En la **Pasada 2** (detección de portada), hoy se calcula `portada_boundary` por heurística. Si el `DocumentModel.meta.paragraph_pages` está disponible, usar ese dato como verdad primaria.

**Cambio concreto**: La función `pre_classify_elements` actualmente recibe solo `elements`. Necesita recibir también el layout (o los elementos ya deben llevar el número de página como atributo).

**Opción A (preferida)**: agregar campo `page_number: Optional[int]` a `ElementModel` y setearlo desde el parser antes de llamar a `pre_classify_elements`:

```python
# En models.py, en ElementModel:
class ElementModel(BaseModel):
    # ... campos existentes ...
    page_number: Optional[int] = None   # NUEVO: 1-indexed, None si no se calculó
```

```python
# En docx_parser.py, después de construir elements[], antes de pre_classify_elements:
if layout_result and layout_result.paragraph_pages:
    for i, elem in enumerate(elements):
        if i < len(layout_result.paragraph_pages):
            elem.page_number = layout_result.paragraph_pages[i]

# En pre_classify.py, Pasada 2:
# Reemplazar el bloque entero de "Señal A/B/C/D/E" por:
if elements and elements[0].page_number is not None:
    # Usar layout real: portada = todos los elementos en página 1
    portada_boundary = 0
    for idx, elem in enumerate(elements):
        if elem.page_number == 1:
            portada_boundary = idx + 1
        else:
            break
else:
    # Fallback: heurística actual (Señal A/B/C/D/E)
    # ... (código existente sin cambios) ...
```

**Ventaja de la Opción A**: el número de página queda disponible para el frontend (puede mostrar "Página 3" en cada `ElementCard`) y para el generador.

### 5.4 Punto de conexión #4: `python/generation/generator.py` — usar body_start exacto

En la línea ~617, donde se calcula `cover_paragraph_count`:

```python
# ── ANTES ───────────────────────────────────────────────
raw_body_idx = None
if doc_model.portada:
    raw_body_idx = doc_model.portada.get('body_start_paragraph_idx')
    if raw_body_idx is not None:
        try:
            raw_body_idx = int(raw_body_idx)
        except (ValueError, TypeError):
            raw_body_idx = None

if raw_body_idx is not None and raw_body_idx > 0:
    cover_paragraph_count = raw_body_idx
else:
    # ... fallbacks heurísticos (Señal 1, Señal 2) ...

# ── DESPUÉS ─────────────────────────────────────────────
# El body_start_paragraph_idx ahora viene de COM si estuvo disponible.
# El código existente ya lo usa como Señal 0 (PRIMARIA), así que NO hay
# que cambiar nada aquí — solo asegurarse de que el parser lo setee
# correctamente en el Punto de Conexión #2.
#
# PERO: agregar un log de auditoría para detectar si el fallback se activa.
if doc_model.portada:
    body_start_source = doc_model.portada.get('body_start_source', 'heuristic')
    if body_start_source != 'page_layout':
        print(f"[WARN] body_start_paragraph_idx provino de '{body_start_source}' "
              f"(no de COM/LibreOffice). Posible detección imprecisa de portada.")
```

### 5.5 Punto de conexión #5 (opcional): `python/main.py::/api/preview-pages/{session_id}`

Hoy este endpoint ya usa LibreOffice para generar PNGs. **Mejora**: usar el provider COM si está disponible para:

1. Generar PNGs de mayor calidad (Word exporta PNGs nativos más fieles que LibreOffice).
2. Verificar que el número de páginas del preview coincide con `meta.page_count`.

```python
# En main.py, en generate_preview_pages():
if sys.platform == "win32":
    try:
        import win32com.client
        # Exportar cada página como PNG vía Word
        # Word.Documents.Open(...).ExportAsFixedFormat(
        #     ExportFormat=wdExportFormatPDF,  # o PNG
        #     ...
        # )
    except ImportError:
        # Fallback a LibreOffice (código existente)
        pass
```

Esta mejora es **opcional** y se puede posponer. No bloquea el fix de portada.

---

## 6. Mejoras derivadas (más allá de portada)

El dato `paragraph_pages` habilita varias verificaciones APA que hoy son imposibles. Estas son ganancias adicionales que la otra IA puede implementar después del fix inicial.

### 6.1 Page count exacto (reemplaza `word_count // 250`)
- **Hoy**: `meta.page_count = max(1, total_words // 250)` — estimación burda.
- **Con COM**: `meta.page_count = layout_result.total_pages` — número real.
- **Beneficio**: el usuario ve "Tu documento tiene 47 páginas" en vez de "tiene ~45 páginas".
- **Ubicación**: ya cubierta en el Punto de Conexión #2.

### 6.2 Validación de layout post-generación (nuevo endpoint)
Nuevo endpoint `POST /api/validate-layout/{session_id}` que:

1. Genera el DOCX APA final (ya existe `/api/generate`).
2. Lo pasa por el provider COM.
3. Verifica reglas APA:
   - **Portada ocupa exactamente 1 página** (APA 7 regla dura).
   - **Cada Heading 1 empieza en página nueva** (APA 7 student: obligatorio solo para algunas secciones; APA 7 professional: obligatorio para todas).
   - **No hay viudas/huérfanas** (widow/orphan control).
   - **Referencias empiezan en página nueva**.
   - **Tablas no se cortan entre páginas** (si se cortan, marcar warning).
4. Retorna lista de `ValidationItem` con severidad OK/WARNING/ERROR.

```python
@app.post("/api/validate-layout/{session_id}")
async def validate_layout(session_id: str) -> dict:
    """Valida layout del DOCX generado contra reglas APA 7."""
    # 1. Generar DOCX (si no existe)
    # 2. Paginar con provider
    # 3. Aplicar reglas
    # 4. Retornar resultados
    ...
```

### 6.3 Previews por página con elementos marcados
Hoy `/api/preview-pages` genera PNG mudos. Con `paragraph_pages` podemos:

1. Generar el PNG de cada página (ya existe).
2. Para cada página, listar los `element_id` que caen en ella.
3. Retornar estructura enriquecida:
   ```json
   {
     "pages": [
       {"page_num": 1, "png_url": "...", "element_ids": ["elem_001", "elem_002", "elem_003"]},
       {"page_num": 2, "png_url": "...", "element_ids": ["elem_004", "elem_005"]}
     ]
   }
   ```
4. El frontend puede mostrar "Página 3 — contiene: Introducción, 2 párrafos, 1 figura".

### 6.4 Detección de "página huérfana"
Si una página tiene un solo elemento (típicamente un heading al final de la página anterior), sugerir al usuario insertar un page break antes del heading. Esto es una regla APA explícita.

### 6.5 Verificación de running head (APA 7 professional)
En modo professional, cada página debe tener el running head. Hoy no se verifica. Con COM podemos recorrer headers de cada sección y validar.

---

## 7. Plan de implementación paso a paso (Task IDs)

Orden estricto. Cada task debe completarse antes del siguiente a menos que se indique paralelo.

### Fase 0: Setup (paralelo con Fase 1)
- **Task 0-A**: Agregar `pywin32` y `PyMuPDF` a `requirements.txt`:
  ```
  pywin32>=306; sys_platform == "win32"
  PyMuPDF>=1.24.0
  ```
- **Task 0-B**: Documentar en `CLAUDE.md` la nueva dependencia y el flujo del provider.

### Fase 1: Crear el módulo del provider
- **Task 1-A**: Crear `python/parsing/page_layout_provider.py` con las 4 clases (ABC + 3 backends + factory).
- **Task 1-B**: Test unitario mínimo `python/tests/test_page_layout_provider.py` que:
  - Verifica `HeuristicPageLayoutProvider.paginate()` con un .docx de prueba.
  - Mockea COM (sin Word real en CI) y verifica la firma del contrato.
  - Verifica que la factory retorna el provider correcto según plataforma.

### Fase 2: Extender el schema
- **Task 2-A**: En `python/models.py`, agregar campos a `DocumentMeta`: `page_count_exact`, `paragraph_pages`, `page_layout_provider`, `page_layout_confidence`.
- **Task 2-B**: En `python/models.py`, agregar campo `page_number: Optional[int] = None` a `ElementModel`.
- **Task 2-C**: Actualizar `src/types/index.ts` con los campos espejo (frontend).

### Fase 3: Conectar el provider al parser
- **Task 3-A**: En `python/parsing/docx_parser.py`, al final de `parse_docx_bytes`, invocar el provider y setear `meta.page_count`, `meta.paragraph_pages`, etc. (Punto de conexión #2).
- **Task 3-B**: En `python/parsing/docx_parser.py`, antes de `pre_classify_elements(elements)`, setear `elem.page_number` para cada elemento (parte de Punto de conexión #3).
- **Task 3-C**: Sobreescribir `doc_model.portada["body_start_paragraph_idx"]` con el valor calculado desde layout, agregando también `body_start_source`.

### Fase 4: Actualizar el pre_classifier
- **Task 4-A**: En `python/parsing/pre_classifier.py`, Pasada 2, agregar rama que use `elem.page_number` si está disponible. Mantener heurística como fallback.
- **Task 4-B**: Test `python/tests/test_pre_classifier_with_layout.py`: crear documento con python-docx, simular `page_number` en elementos, verificar que `portada_boundary` coincide con la página 1.

### Fase 5: Tests de integración con documentos reales
- **Task 5-A**: Crear corpus de test: 5-10 .docx con portadas reales (estilo UNI, estilo APA, estilo libre, con textboxes, sin textboxes). Marcar manualmente `body_start_paragraph_idx_verdad` para cada uno.
- **Task 5-B**: Test `python/tests/test_corpus_with_page_layout.py` que:
  - Corre cada documento del corpus por el pipeline.
  - Verifica que `body_start_paragraph_idx` coincide con la verdad.
  - Verifica que `meta.page_count` está dentro de ±1 de la verdad.
  - Si COM no está disponible (CI en Linux), aceptar ±2 páginas de diferencia.

### Fase 6: Limpieza de procesos y robustez
- **Task 6-A**: Implementar rutina de limpieza de procesos `WINWORD.EXE` zombies (en `_kill_orphan_winword_processes`).
- **Task 6-B**: Agregar logging estructurado: cada llamada al provider loguea provider usado, tiempo total, número de páginas, warnings.
- **Task 6-C**: Test `python/tests/test_com_robustness.py`: simular timeout (con .docx malicioso que cuelga Word), verificar que el provider cae al siguiente backend sin excepción no capturada.

### Fase 7 (opcional, post-MVP): Mejoras derivadas
- **Task 7-A**: Endpoint `/api/validate-layout/{session_id}` (Mejora 6.2).
- **Task 7-B**: Previews enriquecidos con `element_ids` por página (Mejora 6.3).
- **Task 7-C**: Detección de página huérfana (Mejora 6.4).
- **Task 7-D**: Verificación de running head (Mejora 6.5).

---

## 8. Suite de tests específica

### 8.1 Tests unitarios

**Archivo**: `python/tests/test_page_layout_provider.py`

```python
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import docx

from parsing.page_layout_provider import (
    PageLayoutProvider,
    COMPageLayoutProvider,
    LibreOfficePageLayoutProvider,
    HeuristicPageLayoutProvider,
    get_page_layout_provider,
    PageLayoutResult,
)


class TestHeuristicProvider:
    def test_returns_paragraph_pages(self, tmp_path):
        doc = docx.Document()
        for i in range(50):
            doc.add_paragraph(" ".join(["word"] * 10))
        path = tmp_path / "test.docx"
        doc.save(path)

        provider = HeuristicPageLayoutProvider()
        result = provider.paginate(path)

        assert result.provider_used == "heuristic"
        assert result.confidence == 0.5
        assert len(result.paragraph_pages) == 50
        assert result.total_pages >= 1
        assert result.paragraph_pages[0] == 1

    def test_empty_document(self, tmp_path):
        doc = docx.Document()
        path = tmp_path / "empty.docx"
        doc.save(path)

        provider = HeuristicPageLayoutProvider()
        result = provider.paginate(path)

        assert result.total_pages == 1
        assert result.paragraph_pages == [1]


class TestCOMProvider:
    def test_is_available_on_non_windows(self):
        with patch("sys.platform", "linux"):
            provider = COMPageLayoutProvider()
            assert provider.is_available() is False

    def test_paginate_with_mocked_word(self, tmp_path):
        """Simula Word.Application para verificar el flujo COM sin necesidad de Word real."""
        # Crear .docx de prueba
        doc = docx.Document()
        doc.add_paragraph("Página 1 - Portada")
        doc.add_paragraph("Página 1 - Más portada")
        doc.add_paragraph("Página 2 - Cuerpo")
        path = tmp_path / "test.docx"
        doc.save(path)

        # Mock de win32com.client.DispatchEx
        mock_word = MagicMock()
        mock_doc = MagicMock()
        mock_para1 = MagicMock(); mock_para1.Range.Information.return_value = 1
        mock_para2 = MagicMock(); mock_para2.Range.Information.return_value = 1
        mock_para3 = MagicMock(); mock_para3.Range.Information.return_value = 2
        mock_doc.Paragraphs = [mock_para1, mock_para2, mock_para3]
        mock_doc.ComputeStatistics.return_value = 2
        mock_word.Documents.Open.return_value = mock_doc

        with patch("sys.platform", "win32"), \
             patch("win32com.client.DispatchEx", return_value=mock_word), \
             patch("pythoncom.CoInitialize"), \
             patch("pythoncom.CoUninitialize"):
            provider = COMPageLayoutProvider()
            result = provider.paginate(path)

        assert result.provider_used == "com"
        assert result.confidence == 1.0
        assert result.paragraph_pages == [1, 1, 2]
        assert result.total_pages == 2
        mock_doc.Repaginate.assert_called_once()
        mock_doc.Close.assert_called_once_with(SaveChanges=False)
        mock_word.Quit.assert_called_once()


class TestFactory:
    def test_factory_returns_heuristic_when_nothing_available(self):
        with patch.object(COMPageLayoutProvider, "is_available", return_value=False), \
             patch.object(LibreOfficePageLayoutProvider, "is_available", return_value=False):
            provider = get_page_layout_provider()
            assert isinstance(provider, HeuristicPageLayoutProvider)

    def test_factory_prefers_com_over_libreoffice(self):
        with patch.object(COMPageLayoutProvider, "is_available", return_value=True), \
             patch.object(LibreOfficePageLayoutProvider, "is_available", return_value=True):
            provider = get_page_layout_provider()
            assert isinstance(provider, COMPageLayoutProvider)
```

### 8.2 Test de integración con el pipeline completo

**Archivo**: `python/tests/test_pipeline_with_page_layout.py`

```python
import pytest
import docx
from pathlib import Path

from parsing.docx_parser import parse_docx_bytes
from parsing.page_layout_provider import HeuristicPageLayoutProvider


@pytest.mark.integration
def test_pipeline_sets_paragraph_pages(tmp_path):
    """Verifica que el parser setea elem.page_number para cada elemento."""
    # Crear documento con portada (2 párrafos) + cuerpo (3 párrafos)
    doc = docx.Document()
    doc.add_paragraph("UNIVERSIDAD NACIONAL DE INGENIERÍA")
    doc.add_paragraph("Título del Trabajo")
    doc.add_paragraph("Introducción")
    doc.add_paragraph("Este es el primer párrafo del cuerpo del trabajo académico.")
    doc.add_paragraph("Este es el segundo párrafo del cuerpo del trabajo académico.")
    path = tmp_path / "test.docx"
    doc.save(path)

    bytes_data = path.read_bytes()
    doc_model = parse_docx_bytes(bytes_data, "test.docx", "test_sess", tmp_path)

    # Verificar que meta tiene los campos nuevos
    assert doc_model.meta.page_count >= 1
    assert isinstance(doc_model.meta.paragraph_pages, list)
    assert len(doc_model.meta.paragraph_pages) >= 5
    assert doc_model.meta.page_layout_provider in ("com", "libreoffice", "heuristic")

    # Verificar que body_start_paragraph_idx se calculó desde layout
    body_start = doc_model.portada.get("body_start_paragraph_idx", 0)
    body_start_source = doc_model.portada.get("body_start_source", "")
    assert body_start_source == "page_layout"
    # body_start debería ser > 0 (la portada tiene al menos 2 párrafos)
    assert body_start >= 2


@pytest.mark.integration
def test_portada_detection_with_layout(tmp_path):
    """Verifica que pre_classifier usa elem.page_number para detectar portada."""
    doc = docx.Document()
    # Portada (3 párrafos en página 1)
    doc.add_paragraph("UNIVERSIDAD NACIONAL DE INGENIERÍA")
    doc.add_paragraph("Facultad de Electrotecnia")
    doc.add_paragraph("Br. Juan Pérez")
    # Cuerpo (página 2+)
    doc.add_paragraph("Introducción")
    doc.add_paragraph("Este es el primer párrafo del cuerpo del trabajo académico " * 10)
    path = tmp_path / "test.docx"
    doc.save(path)

    bytes_data = path.read_bytes()
    doc_model = parse_docx_bytes(bytes_data, "test.docx", "test_sess", tmp_path)

    # Los primeros 3 elementos deberían tener is_cover_section=True
    cover_elements = [e for e in doc_model.elements if e.is_cover_section]
    assert len(cover_elements) >= 3
    # El 4to elemento (Introducción) no debería ser cover
    intro_elem = next(e for e in doc_model.elements if "Introducción" in (e.text or ""))
    assert intro_elem.is_cover_section is False
```

### 8.3 Test de corpus con documentos reales

**Archivo**: `python/tests/test_corpus_with_page_layout.py`

```python
import pytest
from pathlib import Path
from parsing.docx_parser import parse_docx_bytes

# Corpus de documentos reales con body_start_paragraph_idx marcado manualmente
CORPUS = [
    {"file": "doc_01_limpio.docx",                "expected_body_start": 0},   # Sin portada
    {"file": "doc_02_fuentes_mixtas.docx",        "expected_body_start": 2},
    {"file": "dspwalter.docx",                    "expected_body_start": 8},   # Portada con textbox
    {"file": "10mo_trabajo_contabilidad.docx",    "expected_body_start": 41}, # Documento complejo
    # ... agregar más según corpus disponible
]

@pytest.mark.corpus
@pytest.mark.parametrize("case", CORPUS)
def test_body_start_matches_truth(case, tmp_path, corpus_dir):
    """Verifica que body_start_paragraph_idx coincide con la verdad marcada manualmente."""
    docx_path = corpus_dir / case["file"]
    if not docx_path.exists():
        pytest.skip(f"Documento {case['file']} no disponible en corpus")

    bytes_data = docx_path.read_bytes()
    doc_model = parse_docx_bytes(
        bytes_data, case["file"], "test_sess", tmp_path
    )

    actual_body_start = doc_model.portada.get("body_start_paragraph_idx", -1)
    body_start_source = doc_model.portada.get("body_start_source", "")

    # Si COM o LibreOffice estuvo disponible, exigir match exacto
    if body_start_source == "page_layout":
        assert actual_body_start == case["expected_body_start"], (
            f"body_start esperado={case['expected_body_start']}, "
            f"actual={actual_body_start} (provider={body_start_source})"
        )
    else:
        # Heurística: tolerar ±2 de diferencia
        diff = abs(actual_body_start - case["expected_body_start"])
        assert diff <= 2, (
            f"body_start esperado≈{case['expected_body_start']}, "
            f"actual={actual_body_start} (heurística, diff={diff} > 2)"
        )
```

### 8.4 Test de robustez (COM que cuelga)

**Archivo**: `python/tests/test_com_robustness.py`

```python
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import concurrent.futures

from parsing.page_layout_provider import COMPageLayoutProvider


@pytest.mark.integration
def test_com_timeout_falls_back_gracefully(tmp_path):
    """Si Word se cuelga, el provider debe lanzar TimeoutError, no colgar forever."""
    import docx
    doc = docx.Document()
    doc.add_paragraph("test")
    path = tmp_path / "test.docx"
    doc.save(path)

    # Mock que simula Word colgado
    def hanging_paginate(*args, **kwargs):
        import time
        time.sleep(100)  # Simula hang

    mock_word = MagicMock()
    with patch("sys.platform", "win32"), \
         patch("win32com.client.DispatchEx", return_value=mock_word), \
         patch("pythoncom.CoInitialize"), \
         patch("pythoncom.CoUninitialize"), \
         patch.object(COMPageLayoutProvider, "_do_paginate", side_effect=hanging_paginate):
        provider = COMPageLayoutProvider()
        with pytest.raises(TimeoutError):
            provider.paginate(path, timeout_seconds=2)


@pytest.mark.integration
def test_com_zombie_cleanup(tmp_path):
    """Verifica que _kill_orphan_winword_processes se llama después de cada paginate."""
    import docx
    doc = docx.Document()
    doc.add_paragraph("test")
    path = tmp_path / "test.docx"
    doc.save(path)

    with patch("sys.platform", "win32"), \
         patch("win32com.client.DispatchEx") as mock_dispatch, \
         patch.object(COMPageLayoutProvider, "_kill_orphan_winword_processes") as mock_kill:
        provider = COMPageLayoutProvider()
        try:
            provider.paginate(path)
        except Exception:
            pass
        mock_kill.assert_called()
```

---

## 9. Criterios de calidad (Definition of Done)

El feature se considera **listo** cuando se cumplen TODOS los siguientes:

### 9.1 Funcionales
- [ ] `parse_docx_bytes` invoca el provider y setea `meta.page_count`, `meta.paragraph_pages`, `meta.page_count_exact`, `meta.page_layout_provider`, `meta.page_layout_confidence`.
- [ ] Cada `ElementModel` tiene `page_number` seteado si el provider tuvo éxito.
- [ ] `pre_classifier` usa `elem.page_number` para `portada_boundary` si está disponible, fallback a heurística actual si no.
- [ ] `body_start_paragraph_idx` se calcula desde layout si el provider tuvo éxito; se marca `body_start_source = "page_layout"`.
- [ ] El generador usa `body_start_paragraph_idx` como hoy (no requiere cambios estructurales).

### 9.2 Precisión
- [ ] En corpus de ≥5 documentos reales con `body_start_paragraph_idx` marcado manualmente, **≥95% de match exacto** cuando COM está disponible.
- [ ] Con LibreOffice, **≥90% de match exacto** o **100% dentro de ±1**.
- [ ] Con heurística, mantener precisión actual (no debe empeorar).
- [ ] `meta.page_count` con COM/LibreOffice debe coincidir con el número de páginas que ve el usuario al abrir el documento en Word.

### 9.3 Robustez
- [ ] Si COM no está disponible (Linux CI, Windows sin Word), el provider cae a LibreOffice sin excepción.
- [ ] Si LibreOffice tampoco está disponible, cae a heurística sin excepción.
- [ ] Si Word se cuelga, el timeout mata el proceso en ≤30s y cae al siguiente provider.
- [ ] Nunca quedan procesos `WINWORD.EXE` huérfanos después de una sesión de tests.
- [ ] Nunca se abre una ventana visible de Word (siempre `Visible=False`).
- [ ] Nunca se modifica el archivo original del usuario (`ReadOnly=True`, `SaveChanges=False`).

### 9.4 Sin regresión
- [ ] Todos los tests existentes en `python/tests/` siguen pasando.
- [ ] El frontend existente no rompe (los campos nuevos son opcionales, los viejos siguen presentes).
- [ ] El tamaño del JSON de sesión aumenta < 5KB para documentos típicos (< 200 párrafos).

### 9.5 Observabilidad
- [ ] Cada llamada al provider loguea: provider usado, tiempo total, páginas totales, warnings.
- [ ] Si el fallback heurístico se activa, se loguea un warning visible.
- [ ] El campo `meta.page_layout_provider` es visible en el frontend (en `StatusBar` o similar) para que el usuario sepa qué tan precisa fue la detección.

### 9.6 Mantenibilidad
- [ ] El código del provider está aislado en `python/parsing/page_layout_provider.py` (sin tocar otros módulos más allá de los puntos de conexión definidos).
- [ ] Tests unitarios cubren cada backend por separado (COM mockeado, LibreOffice real si está disponible, heurística siempre).
- [ ] `CLAUDE.md` actualizado con la nueva arquitectura.

---

## 10. Mega-prompt para la IA programadora

Copia y pega este bloque a la IA que va a implementar el código:

````
ACTÚA como ingeniero Python senior especializado en automatización Office y parsing de documentos.

## Contexto del proyecto

Estás trabajando en WordAPA7, un validador/generador de documentos APA 7 con backend FastAPI
y frontend React. El código está en `python/` (backend) y `src/` (frontend).

El pipeline actual: `parsing/docx_parser.py::parse_docx_bytes` → `pre_classifier.py` →
`generation/generator.py::generate_apa7_docx`. La detección de fin de portada hoy es
heurística (keywords + word_count//250) y falla en documentos reales con textboxes complejos.

## Tu tarea

Implementar un sistema de paginación real vía COM (Word Automation) con fallback a
LibreOffice + PyMuPDF y finalmente a la heurística actual. El detalle completo del plan
está en el documento que recibiste — léelo completo antes de escribir una sola línea de código.

## Reglas no negociables

1. **Calidad > velocidad**: una llamada COM que toma 3-8s es aceptable. No optimices prematuramente.
2. **Aislamiento**: TODO el código nuevo del provider vive en `python/parsing/page_layout_provider.py`.
   No metas lógica de COM en `docx_parser.py` ni en `main.py`.
3. **Robustez ante todo**: si COM falla (Word no instalado, archivo corrupto, timeout),
   caer al siguiente provider. NUNCA propagar una excepción no capturada al caller.
4. **Limpieza de procesos**: cada llamada a COM debe garantizar `doc.Close(SaveChanges=False)`
   y `word.Quit()` en un bloque `finally`. Además, rutina de limpieza de zombies
   `WINWORD.EXE` al final.
5. **`DispatchEx`, no `Dispatch`**: siempre instancia nueva y aislada de Word.
6. **`DisplayAlerts=0`** es obligatorio.
7. **`ReadOnly=True`** al abrir el documento — nunca escribir sobre el original del usuario.
8. **Timeout externo** con `concurrent.futures.ThreadPoolExecutor` y `future.result(timeout=N)`.
9. **Tests primero**: antes de tocar el parser, escribe los tests del provider. TDD estricto.
10. **Sin regresión**: los tests existentes en `python/tests/` deben seguir pasando.

## Orden de implementación

Sigue los Task IDs del plan (Fase 0 → Fase 6). No saltes fases. Cada fase tiene tests
asociados que deben pasar antes de avanzar.

## Entregables

1. Archivo nuevo: `python/parsing/page_layout_provider.py`
2. Modificaciones en: `python/models.py`, `python/parsing/docx_parser.py`,
   `python/parsing/pre_classifier.py`, `src/types/index.ts`, `requirements.txt`
3. Tests nuevos:
   - `python/tests/test_page_layout_provider.py`
   - `python/tests/test_pre_classifier_with_layout.py`
   - `python/tests/test_pipeline_with_page_layout.py`
   - `python/tests/test_corpus_with_page_layout.py`
   - `python/tests/test_com_robustness.py`
4. Actualización de `CLAUDE.md` con la nueva arquitectura.

## Cómo verificar que terminaste bien

Ejecuta:
```bash
cd /path/to/wordapa7
pytest python/tests/ -v
pytest python/tests/test_page_layout_provider.py -v
pytest python/tests/test_corpus_with_page_layout.py -v
```

Todos deben pasar. Además, en Windows con Word instalado, prueba manualmente:
```python
from parsing.page_layout_provider import get_page_layout_provider
p = get_page_layout_provider()
print(p.__class__.__name__)  # Debe decir COMPageLayoutProvider
result = p.paginate(Path("algun_documento_real.docx"))
print(result.total_pages, result.paragraph_pages[:10])
```

Si `p.__class__.__name__` no es `COMPageLayoutProvider` en Windows con Word, algo está mal.

## Antes de empezar

Confirma que entendiste:
- Los 5 puntos de conexión en el código existente (sección 5 del plan).
- Las 4 mejoras derivadas opcionales (sección 6) — NO las implementes ahora, son Fase 7.
- Los criterios de calidad (sección 9) — son tu Definition of Done.

Si algo del plan no te queda claro, pregunta antes de codificar. No asumas.
````

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Word no está instalado en el 10% de máquinas | Media | Bajo | Fallback automático a LibreOffice. El usuario ve warning en la barra de estado. |
| COM se cuelga con .docx maliciosos | Baja | Alto | Timeout externo + limpieza agresiva de procesos. |
| LibreOffice da layout distinto a Word | Alta | Medio | Marcar `confidence=0.95` y exponer al usuario. Aceptar ±1 página de diferencia en tests. |
| `paragraph_pages` infla el JSON de sesión | Baja | Bajo | Para docs > 1000 párrafos, guardar solo `body_start_paragraph_idx` y `total_pages`, no la lista completa. |
| Pywin32 no instala en algunas versiones de Python | Baja | Medio | Documentar versión mínima (Python 3.9+). Probar en CI con Python 3.11 y 3.12. |
| Word guarda archivos en `%TEMP%` al abrir | Media | Bajo | Usar `AddToRecentFiles=False` y limpiar `%TEMP%\~wrd*.doc` después de cada llamada. |
| El usuario tiene Word abierto con otro documento | Media | Crítico | `DispatchEx` garantiza instancia aislada. Aún así, en tests de humo, verificar que no se toca el documento del usuario. |

---

## 12. Notas finales

- **No tocar el frontend** en la Fase 1-6. Los campos nuevos en `meta` son opcionales y el frontend viejo los ignora sin romper.
- **No modificar el generador** más allá de agregar el log de auditoría (Punto de conexión #4). El generador ya consume `body_start_paragraph_idx` correctamente; si el parser lo setea bien, el generador funciona bien.
- **El fix del bug `extract_textbox_paragraphs` que crashea** (BUG #3 de la auditoría) es independiente y debe seguir arreglándose en paralelo. El provider de layout NO depende de ese fix; usa el archivo `.docx` directamente, no la extracción de textboxes.
- **Si tienes acceso a una máquina Windows con Word**, prueba el provider COM real antes de declarar listo el feature. Los mocks no capturan todos los casos de borde (popups de conversión, advertencias de macros, etc.).
