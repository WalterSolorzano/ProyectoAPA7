# WORDAPA7 — MEGAPROMPT DE MEJORAS, PROPUESTAS DE IMPLEMENTACIÓN Y REDESIGN

> **Versión**: 2.0 | **Fecha**: 2026-07-25
> **Tipo**: Megaprompt para implementación por IA (Gemini / Claude / GPT)
> **Alcance**: Arquitectura completa del sistema — Backend Python + Frontend React + Integraciones

---

## ÍNDICE

1. [DIAGNÓSTICO DEL ESTADO ACTUAL](#1-diagnóstico-del-estado-actual)
2. [PROBLEMA 1: IMPORTACIÓN LENTA — Solución Completa](#2-problema-1-importación-lenta)
3. [PROBLEMA 2: PREVIEW FALLA / BAJA FIDELIDAD — Solución Completa](#3-problema-2-preview-falla)
4. [PROBLEMA 3: DETECCIÓN DE TÍTULOS (HEADING) — Mejora Estructural](#4-problema-3-detección-de-títulos)
5. [PROBLEMA 4: DETECCIÓN DE IMÁGENES — Cobertura Completa](#5-problema-4-detección-de-imágenes)
6. [PROBLEMA 5: GENERACIÓN DOCX FRAGIL — Arquitectura Robusta](#6-problema-5-generación-fragil)
7. [PROBLEMA 6: UI/UX — Rediseño Completo](#7-problema-6-ui-redesign)
8. [PROBLEMA 7: BUGS CRÍTICOS EXISTENTES — Fixes Required](#8-problema-7-bugs-criticos)
9. [TECNOLOGÍAS FALTANTES — Lo que el sistema NO tiene y DEBERÍA tener](#9-tecnologías-faltantes)
10. [TECNOLOGÍAS SUPERADAS — "Estás haciendo X pero es mejor Y"](#10-tecnologías-superadas)
11. [PROPUESTAS DE IMPLEMENTACIÓN — Set Completo](#11-propuestas-de-implementación)
12. [PLAN DE FASES — Roadmap de Implementación](#12-plan-de-fases)
13. [ARQUITECTURA FINAL PROPUESTA](#13-arquitectura-final)

---

## 1. DIAGNÓSTICO DEL ESTADO ACTUAL

### 1.1 Arquitectura Actual

```
┌─────────────────────────────────────────────────┐
│  Frontend: React 18 + Vite + Zustand            │
│  (NO Electron — es SPA servida desde FastAPI)    │
│  ~6,292 LOC, 40+ componentes                    │
│  CSS 100% inline style={{}} — sin framework     │
│  Preview: CSS approximation ~60% fidelidad       │
│  mammoth.js importado pero NO usado              │
│  Store monolítico: 1 Zustand store, 60+ fields   │
│  2 librerías DnD: @dnd-kit + @hello-pangea/dnd   │
└─────────────────────────────────────────────────┘
          │ fetch /api → localhost:8742
          ▼
┌─────────────────────────────────────────────────┐
│  Backend: FastAPI + python-docx + lxml           │
│  ~10,312 LOC, 30+ módulos Python                │
│  main.py: 1,774 LOC, 37 endpoints               │
│  Parse: synchronous, blocks event loop           │
│  LibreOffice: subprocess.run per call (3-8s)     │
│  NO COM/Word automation (solo docx2pdf fallback) │
│  LLM: 8 providers async parallel (NVIDIA→...→Gemini)│
│  Session: JSON on disk (no DB)                   │
│  Idempotency: SQLite SHA-256                     │
└─────────────────────────────────────────────────┘
```

### 1.2 Cuellos de Botella Identificados

| Área | Problema | Impacto | Severidad |
|------|----------|---------|-----------|
| **Upload** | `parse_docx_bytes()` synchronous, blocks uvicorn loop | Documento 208 elem = 8-15s bloqueo total | 🔴 CRITICAL |
| **Upload** | Triple ZIP decompression (3× apertura de numbering.xml) | +3-5s redundantes | 🔴 HIGH |
| **Upload** | Per-element AI detection (`analyze_ai_risk()`) en cada parse | +2-4s en docs grandes | 🟡 MEDIUM |
| **Upload** | Image blob I/O synchronous (cada imagen write individual) | +1-3s con muchas imágenes | 🟡 MEDIUM |
| **Preview** | LibreOffice subprocess.run per request (cold start 3-8s) | Preview tarda 10-30s | 🔴 CRITICAL |
| **Preview** | No conversion queue — requests concurrentes colisionan | Error/crash en preview simultáneo | 🔴 HIGH |
| **Preview** | Endpoint format mismatch (backend returns JSON, frontend expects HTML) | Preview "Corregido" nunca funciona | 🔴 CRITICAL |
| **Preview** | No caching — regenera cada llamada | Desperdicio 10-30s por preview | 🟡 MEDIUM |
| **Classification** | `needs_review=False` universal (Pass 3 sobreescribe todo) | LLM classify button useless | 🔴 CRITICAL |
| **Generation** | Paragraph-matching por posición es fragil | Cover count=0 → misalignment total | 🟡 MEDIUM |
| **UI** | 90% inline styles, no component library | Mantenimiento nightmare | 🟡 MEDIUM |
| **UI** | 3 upload UIs separados, redundantes | Confusión + código duplicado | 🟡 MEDIUM |

---

## 2. PROBLEMA 1: IMPORTACIÓN LENTA

### 2.1 Diagnóstico Detallado

**Flujo actual** (`main.py` lines 260-340 → `docx_parser.py` lines 520-959):

1. SHA-256 hash del archivo completo
2. `sanitize_numbering_xml()` — RE-ZIP el DOCX completo
3. `_get_numbering_type_map()` — RE-READ numbering.xml del ZIP
4. `Document()` — python-docx abre el ZIP otra vez
5. `extract_textbox_paragraphs()` — lxml deep scan del XML
6. `_detect_toc_paragraph_indices()` — otro XML scan
7. MAIN LOOP: iterar todos los `<w:p>` y `<w:tbl>` con format detection, image extraction, numbering detection
8. `pre_classify_elements()` — 3-pass heuristic (otro loop completo)
9. `analyze_ai_risk()` — 40+ regex patterns PER ELEMENT ≥15 chars
10. Portada inference (textbox + paragraph methods)
11. `find_body_start_via_xml()` — RE-OPEN ZIP otra vez

**Problemas clave**:
- **Triple ZIP access**: numbering.xml se abre 3 veces (sanitize, numbering map, body-start)
- **Blocking sync**: `parse_docx_bytes()` bloquea el event loop de uvicorn completamente
- **AI detection en upload**: se ejecuta siempre, no es opcional ni deferido
- **Re-zip overhead**: `sanitize_numbering_xml()` re-comprime el ZIP completo

### 2.2 Propuesta: Pipeline de Importación Optimizado

**Arquitectura propuesta** — Pipeline en 3 fases NO bloqueantes:

**FASE 1**: Extracción rápida (ZIP → XML cache) — ~0.5-1s. Una sola apertura del ZIP que extrae TODO: numbering_map, section_info, body_xml, images_blob_map, textbox_texts.

**FASE 2**: Parse + classify — `asyncio.to_thread()` — ~2-4s. Core parsing en thread pool, no bloquea event loop.

**FASE 3**: Post-processing (portada, AI detection) — deferido/background. AI detection se ejecuta como BackgroundTask. Frontend puede polling `/api/ai-detection-status/{session_id}`.

**`_extract_zip_single_pass()`** — Una sola apertura del ZIP:

```python
def _extract_zip_single_pass(content: bytes) -> ZipCache:
    """Abre el ZIP UNA vez y extrae todo lo necesario."""
    import zipfile, io
    from lxml import etree

    cache = ZipCache()
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        # numbering.xml — sanitize + map in ONE pass
        if 'word/numbering.xml' in zf.namelist():
            num_xml = zf.read('word/numbering.xml')
            num_tree = etree.fromstring(num_xml)
            cache.numbering_map = _extract_numbering_map_from_tree(num_tree)
            cache.sanitized_numbering_xml = _sanitize_numbering_in_memory(num_tree)

        # document.xml — body + sections
        doc_xml = zf.read('word/document.xml')
        cache.body_tree = etree.fromstring(doc_xml)
        cache.section_info = _extract_sections_from_tree(cache.body_tree)

        # images — blob map (no write to disk yet)
        for name in zf.namelist():
            if name.startswith('word/media/'):
                cache.image_blobs[name] = zf.read(name)

        # Extract textbox texts from body_tree
        cache.textbox_texts = _extract_textbox_from_tree(cache.body_tree)

        # TOC indices from body_tree
        cache.toc_indices = _detect_toc_from_tree(cache.body_tree)

    return cache
```

**Beneficios cuantificados**:
- Triple ZIP → Single pass: **ahorro 3-5s**
- Sync → asyncio.to_thread: **event loop NO bloqueado** (otros requests siguen funcionando)
- AI detection deferred: **ahorro 2-4s en respuesta inicial** (usuario ve documento más rápido)
- Image blobs en memory → batch write: **ahorro 1-2s** (un solo write batch vs N writes individuales)

### 2.3 Propuesta: Upload con Progress Streaming

**Frontend**: Replace `fetch()` con streaming upload + progress via XHR:

```typescript
async uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<DocumentModel> {
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(JSON.parse(xhr.responseText).detail));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apa_format', this.apaFormat);
    formData.append('work_mode', this.workMode);
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}
```

**Backend**: WebSocket para progress de upload/parse:

```python
@app.websocket("/ws/parse-progress/{session_id}")
async def parse_progress_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            progress = _parse_progress.get(session_id)
            if progress:
                await websocket.send_json(progress)
                if progress.get("status") == "complete": break
            await asyncio.sleep(0.5)
    finally:
        await websocket.close()
```

**Fases de progress para el frontend**:
```
[Upload]   ████░░░░░░  40%  — Enviando archivo...
[Extract]  ██████░░░░  60%  — Extrayendo estructura XML...
[Parse]    ████████░░  80%  — Analizando párrafos e imágenes...
[Classify] █████████░  90%  — Clasificación heurística...
[Ready]    ██████████ 100%  — Documento listo
```

---

## 3. PROBLEMA 2: PREVIEW FALLA / BAJA FIDELIDAD

### 3.1 Diagnóstico Detallado

**3 sistemas de preview, todos incompletos o rotos**:

| Sistema | Ubicación | Estado | Fidelidad |
|---------|-----------|--------|-----------|
| CSS Preview | `LivePreview.tsx` | Funciona parcialmente | ~60% |
| mammoth.js HTML | Store `previewHtml` | **NO consumido** por LivePreview | N/A |
| LibreOffice PNG | `/api/preview-pages` | **Format mismatch**, subprocess.run lento | ~99% si funciona |

**Problema CSS Preview**:
- Hardcoded `1.` para numbered lists (no sequential)
- `18px` indent approximation (APA es 0.5in = 36pt)
- No page breaks, no pagination
- "Original" toggle no funciona
- Tables simplified, cover images/logos no renderizados

**Problema LibreOffice Preview**:
- subprocess.run per request = 3-8s cold start
- No persistent listener, no queue, no caching
- Response format mismatch
- Frontend no tiene viewer para múltiples páginas PNG

### 3.2 Propuesta: Preview System con PDF.js + LibreOffice Persistent

**Arquitectura propuesta**:

```
┌──────────────────────────────────────────────────┐
│  Frontend: PDFPreview Component                   │
│  ├─ pdf.js viewer (Mozilla) — 100% fidelidad     │
│  ├─ Thumbnail sidebar (miniaturas de páginas)     │
│  ├─ Zoom + scroll + page navigation               │
│  ├─ Overlay de elementos highlight (click→inspect)│
│  └─ Toggle: Original vs Corrected                 │
└──────────────────────────────────────────────────┘
          │ WebSocket progress
          ▼
┌──────────────────────────────────────────────────┐
│  Backend: DocConverterService                     │
│  ├─ LibreOffice listener persistente (socket)     │
│  ├─ Conversion queue (asyncio.Queue + 1 worker)   │
│  ├─ Cache: hash(rules+portada+refs) → PDF cached  │
│  ├─ Fallback: CSS preview si LO no disponible     │
│  └─ Cover preview: PDF extraction primera página  │
└──────────────────────────────────────────────────┘
```

**Componente Frontend: PDFPreview.tsx** (reemplaza LivePreview.tsx):

```typescript
import { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export function PDFPreview({ sessionId, mode, onElementClick }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef(null);

  // WebSocket para progress de generación
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8742/ws/preview-progress/${sessionId}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.pct || 0);
      if (data.status === 'complete') {
        loadPDF(data.pdf_url);
        ws.close();
      }
      if (data.status === 'error') {
        setLoading(false);
        ws.close();
      }
    };
    return () => ws.close();
  }, [sessionId, mode]);

  const loadPDF = async (url) => {
    const doc = await pdfjsLib.getDocument(url).promise;
    setPdfDoc(doc);
    setTotalPages(doc.numPages);
    setCurrentPage(1);
    setLoading(false);
  };

  const renderPage = async (pageNum) => {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
  };

  if (loading) return <ProgressBar value={progress} label={`Generando preview ${progress}%`} />;
  return (
    <div className="pdf-preview-container">
      <div className="pdf-toolbar">
        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))}>←</button>
        <span>{currentPage} / {totalPages}</span>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}>→</button>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
```

**Backend: DocConverterService** — LibreOffice persistent + queue + cache:

```python
class DocConverterService:
    """
    Servicio persistente de conversión DOCX → PDF/PNG.
    Usa LibreOffice en modo listener (--accept socket) para evitar
    cold start de 3-8s en cada conversión.
    """

    def __init__(self, storage_dir):
        self.storage_dir = storage_dir
        self._lo_process = None
        self._lo_available = False
        self._conversion_queue = asyncio.Queue()
        self._cache = {}  # hash → {pdf_path, png_paths, timestamp}
        self._worker_task = None

    async def start(self):
        lo_path = shutil.which("libreoffice") or shutil.which("soffice")
        if not lo_path:
            self._lo_available = False
            return
        self._lo_available = True
        # Iniciar LibreOffice en modo listener
        self._lo_process = subprocess.Popen(
            [lo_path, "--headless", "--invisible", "--norestore",
             "--accept=socket,host=localhost,port=2002;urp;StarOffice.ServiceManager"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        await asyncio.sleep(3)  # LibreOffice takes ~3s to start
        self._worker_task = asyncio.create_task(self._conversion_worker())

    async def convert_to_pdf(self, docx_path, cache_key):
        # Check cache first (1h TTL)
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if cached["pdf_path"].exists() and time.time() - cached["timestamp"] < 3600:
                return cached["pdf_path"]
        # Queue conversion
        future = asyncio.get_event_loop().create_future()
        await self._conversion_queue.put({
            "type": "pdf", "docx_path": docx_path,
            "cache_key": cache_key, "future": future,
        })
        return await future

    async def _conversion_worker(self):
        """Worker que procesa conversions UNA POR UNA (no concurrent)."""
        while True:
            task = await self._conversion_queue.get()
            try:
                if task["type"] == "pdf":
                    result = await self._do_convert_pdf(task["docx_path"])
                    self._cache[task["cache_key"]] = {
                        "pdf_path": result, "timestamp": time.time()
                    }
                    task["future"].set_result(result)
            except Exception as e:
                task["future"].set_exception(e)

    async def _do_convert_pdf(self, docx_path):
        out_dir = docx_path.parent
        result = subprocess.run(
            [shutil.which("libreoffice") or shutil.which("soffice"),
             "--headless", "--convert-to", "pdf",
             "--outdir", str(out_dir), str(docx_path)],
            capture_output=True, text=True, timeout=30,
        )
        pdf_path = out_dir / f"{docx_path.stem}.pdf"
        if not pdf_path.exists():
            raise Exception(f"PDF no generado: {result.stderr[:200]}")
        return pdf_path

    def compute_cache_key(self, rules, portada, references):
        content = json.dumps({"rules": rules, "portada": portada, "refs": references}, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
```

**UNO Python API Approach** (alternativa más avanzada, sin subprocess):

```python
def convert_docx_to_pdf_uno(docx_path, pdf_path, port=2002):
    """Conversión directa via UNO API al LibreOffice listener."""
    import uno
    from com.sun.star.beans import PropertyValue
    local_context = uno.getComponentContext()
    resolver = local_context.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local_context
    )
    context = resolver.resolve(
        f"uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext"
    )
    desktop = context.ServiceManager.createInstanceWithContext(
        "com.sun.star.frame.Desktop", context
    )
    url = uno.systemPathToFileUrl(docx_path)
    doc = desktop.loadComponentFromURL(url, "_blank", 0, ())
    filter_data = PropertyValue()
    filter_data.Name = "FilterName"
    filter_data.Value = "writer_pdf_Export"
    pdf_url = uno.systemPathToFileUrl(pdf_path)
    doc.storeToURL(pdf_url, (filter_data,))
    doc.close(True)
```

### 3.3 Propuesta: Cover Preview via PDF Extraction

**Problema**: `_generate_docx_preview()` en `cover_designer.py` crea un archivo de TEXTO placeholder. No genera PNG real.

**Solución**: Usar PyMuPDF (fitz) para extraer primera página del PDF:

```python
import fitz  # PyMuPDF

def generate_cover_preview_png(docx_path, out_path):
    """Genera preview PNG de portada usando LibreOffice → PDF → PyMuPDF → PNG."""
    if _doc_converter._lo_available:
        pdf_path = await _doc_converter.convert_to_pdf(docx_path, "cover_preview")
        doc = fitz.open(str(pdf_path))
        page = doc[0]  # First page = cover
        pix = page.get_pixmap(dpi=150)
        pix.save(str(out_path))
        doc.close()
        return out_path
    else:
        return _create_cover_placeholder(out_path)
```

---

## 4. PROBLEMA 3: DETECCIÓN DE TÍTULOS (HEADING)

### 4.1 Diagnóstico

**Problema actual**: `pre_classifier.py` evalúa cada párrafo EN ISOLACIÓN con scoring manual (bold=0.4, short=0.2, no period=0.1, font>median=0.2, centered=0.15). No usa clustering, no considera contexto adyacente, no aprende del documento.

**Bug CRITICAL**: Pass 3 asigna `needs_review=False` a casi todo porque el score threshold es muy bajo.

### 4.2 Propuesta: Style Fingerprint Clustering

**Concepto**: Cada párrafo tiene un "fingerprint" de estilo. Headings del mismo nivel tienden a tener fingerprints similares. Clustering agrupa párrafos con fingerprints similares → identifica heading levels por grupo, no por regla individual.

```python
@dataclass
class StyleFingerprint:
    """Vector de características de estilo para un párrafo."""
    font_size: float          # 0-100 (normalizado)
    is_bold: float            # 0.0 or 1.0
    is_italic: float          # 0.0 or 1.0
    is_centered: float        # 0.0 or 1.0
    word_count: float         # 0-50 (normalizado)
    ends_with_period: float   # 0.0 or 1.0
    spacing_before: float     # 0-240 (pt)
    spacing_after: float      # 0-240 (pt)
    indent_left: float        # 0-720 (pt)
    outline_level: float      # 0-9 (from style)
    has_number_prefix: float  # 0.0 or 1.0

    def to_vector(self):
        return np.array([
            self.font_size / 100, self.is_bold, self.is_italic,
            self.is_centered, min(self.word_count, 50) / 50,
            self.ends_with_period, self.spacing_before / 240,
            self.spacing_after / 240, self.indent_left / 720,
            self.outline_level / 9, self.has_number_prefix,
        ])

    @staticmethod
    def from_element(elem, median_font):
        return StyleFingerprint(
            font_size=elem.font_size or median_font,
            is_bold=1.0 if elem.is_bold else 0.0,
            is_italic=1.0 if elem.is_italic else 0.0,
            is_centered=1.0 if elem.alignment == 'center' else 0.0,
            word_count=len(elem.text.split()) if elem.text else 0,
            ends_with_period=1.0 if elem.text and elem.text.rstrip().endswith('.') else 0.0,
            spacing_before=elem.spacing_before or 0,
            spacing_after=elem.spacing_after or 0,
            indent_left=elem.indent_left or 0,
            outline_level=elem.outline_level or 0,
            has_number_prefix=1.0 if _has_number_prefix(elem.text) else 0.0,
        )


class ClusteringHeadingClassifier:
    """
    1. Calcula fingerprints para todos los párrafos
    2. Clusteriza usando DBSCAN (auto-detecta número de clusters)
    3. Identifica clusters que son headings (short, bold, big font)
    4. Asigna levels dentro de heading clusters (por font_size ranking)
    5. Marca needs_review=True para elementos ambiguos
    """

    def classify(self, elements):
        median_font = np.median([e.font_size for e in elements if e.font_size])
        fingerprints = [
            StyleFingerprint.from_element(e, median_font)
            for e in elements if e.text and e.text.strip()
        ]
        vectors = np.array([fp.to_vector() for fp in fingerprints])

        clustering = DBSCAN(eps=0.15, min_samples=2).fit(vectors)
        labels = clustering.labels_

        # Identify heading clusters: high bold ratio, low word count, large font
        heading_clusters = []
        for label, indices in self._group_clusters(labels).items():
            cluster_fps = [fingerprints[i] for i in indices]
            bold_ratio = sum(fp.is_bold for fp in cluster_fps) / len(cluster_fps)
            avg_words = sum(fp.word_count for fp in cluster_fps) / len(cluster_fps)
            avg_font = sum(fp.font_size for fp in cluster_fps) / len(cluster_fps)
            heading_score = bold_ratio * 0.5 + (1 - min(avg_words, 20)/20) * 0.3 + (avg_font > median_font) * 0.2
            if heading_score > 0.5:
                heading_clusters.append((label, indices, heading_score))

        # Assign heading levels by ranking
        heading_clusters.sort(key=lambda x: -x[2])
        for level, (label, indices, score) in enumerate(heading_clusters[:5], 1):
            for idx in indices:
                elem = elements[idx]
                elem.element_type = ElementType.HEADING
                elem.heading_level = level
                elem.confidence = min(0.95, score + 0.3)
                elem.needs_review = score < 0.7

        return elements
```

**Dependencia nueva**: `scikit-learn>=1.5.0` (para DBSCAN). Alternativa lightweight: implementar DBSCAN manually con numpy.

### 4.3 Fix: Pass 3 needs_review Logic

**Fix CRITICAL** — Make Pass 3 respect existing classifications and mark ambiguous elements:

```python
# Pasada 3 CORREGIDA
for i, elem in enumerate(elements):
    # Skip elements already confidently classified by Pass 1 or 2
    if elem.confidence >= 0.85 and elem.element_type != ElementType.PARAGRAPH:
        continue

    # Only re-evaluate uncertain paragraphs
    if elem.element_type != ElementType.PARAGRAPH and elem.confidence < 0.85:
        elem.needs_review = True
        continue

    score = _compute_heading_score(elem, median_font)

    if score >= 0.7:
        elem.element_type = ElementType.HEADING
        elem.heading_level = _infer_level(elem, highest_level_seen)
        elem.confidence = 0.65 + score * 0.3
        elem.needs_review = True  # ALWAYS mark for review
    elif score >= 0.4:
        elem.element_type = ElementType.HEADING
        elem.heading_level = 3  # Default to H3 for borderline
        elem.confidence = 0.50
        elem.needs_review = True  # Definitely needs LLM review
    else:
        elem.element_type = ElementType.PARAGRAPH
        elem.confidence = 0.75
        elem.needs_review = True  # Still might be heading in context
```

---

## 5. PROBLEMA 4: DETECCIÓN DE IMÁGENES — Cobertura Completa

### 5.1 Coverage Actual vs OOXML Spec

| Case | XML Pattern | Detectado? | Nota |
|------|-------------|------------|------|
| Inline image | `wp:inline → a:blip` | ✅ Sí | Funciona |
| Floating image | `wp:anchor → a:blip` | ❌ Parcial | Extrae imagen pero NO captura positioning |
| VML legacy | `v:imagedata` (inside `w:pict`) | ✅ Sí | Funciona |
| Grouped shapes | `wpg:wgp → wsp → a:blip` | ❌ No | No busca recursivamente |
| WordprocessingShape | `wps:wsp → a:blip` | ❌ No | Detectado como textbox, imagen NO extraída |
| SmartArt | `<dgm:dataModel>` | ❌ No | No soportado |

### 5.2 Propuesta: Recursive Image Extraction

```python
NSMAP = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'v': 'urn:schemas-microsoft-com:vml',
    'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
    'wpg': 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
}

def extract_all_images_recursive(paragraph_element, rels, session_dir, session_id):
    """
    Extracción recursiva de TODAS las imágenes en un párrafo.
    Busca en: wp:inline, wp:anchor, wpg:wgp, wps:wsp, w:pict (VML)
    Returns: list[ImageModel] con positioning data
    """
    images = []

    # DrawingML blip search (recursive via .iter())
    for blip in paragraph_element.iter(f'{NSMAP["a"]}blip'):
        r_embed = blip.get(f'{NSMAP["r"]}embed')
        if r_embed and r_embed in rels:
            positioning = _extract_positioning(blip)
            group_info = _extract_group_info(blip)
            source_type = _determine_source_type(blip)
            img_model = ImageModel(
                id=f"img_{len(images)}_{session_id}",
                relative_url=f"/api/images/{session_id}/{Path(rels[r_embed]).name}",
                source_type=source_type,
                positioning=positioning,
                group_info=group_info,
            )
            images.append(img_model)

    # VML imagedata search
    for imagedata in paragraph_element.iter(f'{NSMAP["v"]}imagedata'):
        r_id = imagedata.get(f'{NSMAP["r"]}id')
        if r_id and r_id in rels:
            img_model = ImageModel(
                id=f"img_vml_{len(images)}_{session_id}",
                relative_url=f"/api/images/{session_id}/{Path(rels[r_id]).name}",
                source_type='vml_legacy',
            )
            images.append(img_model)

    return images


def _extract_positioning(blip_element):
    """Extrae atributos de posicionamiento del ancestro wp:anchor."""
    parent = blip_element.getparent()
    while parent is not None:
        if parent.tag == f'{NSMAP["wp"]}anchor':
            extent = parent.find(f'{NSMAP["wp"]}extent')
            pos_h = parent.find(f'{NSMAP["wp"]}positionH')
            pos_v = parent.find(f'{NSMAP["wp"]}positionV')
            return {
                'type': 'floating',
                'width': int(extent.get('cx', '0')) / 914400 if extent is not None else 0,
                'height': int(extent.get('cy', '0')) / 914400 if extent is not None else 0,
                'horizontal_pos': pos_h.find(f'{NSMAP["wp"]}align').get('val', 'left') if pos_h is not None else 'left',
                'vertical_pos': pos_v.find(f'{NSMAP["wp"]}align').get('val', 'top') if pos_v is not None else 'top',
                'behind_text': parent.get('behindDoc', '0') == '1',
            }
        elif parent.tag == f'{NSMAP["wp"]}inline':
            extent = parent.find(f'{NSMAP["wp"]}extent')
            return {
                'type': 'inline',
                'width': int(extent.get('cx', '0')) / 914400 if extent is not None else 0,
                'height': int(extent.get('cy', '0')) / 914400 if extent is not None else 0,
            }
        parent = parent.getparent()
    return {'type': 'unknown'}


def _determine_source_type(blip_element):
    """Determina el tipo de source de la imagen."""
    parent = blip_element.getparent()
    while parent is not None:
        ns_tag = parent.tag.split('}')[-1] if '}' in parent.tag else parent.tag
        if ns_tag == 'wgp': return 'grouped_shape'
        if ns_tag == 'wsp': return 'wordprocessing_shape'
        if ns_tag == 'anchor': return 'floating_anchor'
        if ns_tag == 'inline': return 'inline_drawingml'
        parent = parent.getparent()
    return 'unknown_drawingml'
```

### 5.3 Propuesta: "Figura N" Caption Association by Proximity

```python
def associate_captions_by_proximity(elements):
    """Associa imágenes con captions por proximidad + pattern matching."""
    caption_pattern = re.compile(
        r'^(Figura|Fig\.|Figure|Tabla|Table|Cuadro)\s+(\d+|[ivxlc]+)', re.IGNORECASE
    )

    for i, elem in enumerate(elements):
        if elem.element_type != ElementType.IMAGE:
            continue

        # Look ahead 1-2 elements for caption
        for j in range(i+1, min(i+3, len(elements))):
            next_elem = elements[j]
            if next_elem.element_type == ElementType.EMPTY:
                continue
            if caption_pattern.match(next_elem.text or ''):
                elem.caption_text = next_elem.text
                elem.caption_element_id = next_elem.id
                next_elem.element_type = ElementType.CAPTION
                break

        # Also look behind 1 element
        if i > 0 and not elem.caption_text:
            prev_elem = elements[i-1]
            if caption_pattern.match(prev_elem.text or ''):
                elem.caption_text = prev_elem.text
                prev_elem.element_type = ElementType.CAPTION

    return elements
```

---

## 6. PROBLEMA 5: GENERACIÓN DOCX FRAGIL

### 6.1 Diagnóstico

**generator.py** (1,071 LOC): Paragraph-matching por posición index es fragil. `cover_paragraph_count=0` cuando no se detecta portada → misalignment total.

**layered_generator.py** (262 LOC): Pierde shapes, logos, textboxes, complex formatting del original.

### 6.2 Propuesta: Hybrid Generator con Anchor-Based Matching

**Concepto**: Skeleton DOCX con `<w:bookmarkStart w:name="APA7_{id}"/>` por cada elemento → Format by bookmark ID (not position) → Inject complex elements from original.

```python
def generate_apa7_hybrid(doc_model, output_path, rules, portada, references):
    """Generator híbrido: skeleton + bookmark anchors + inject."""
    # Phase 1: Create clean skeleton with bookmarks
    skeleton_doc = _create_skeleton_with_bookmarks(doc_model, rules)

    # Phase 2: Format content via bookmark anchors
    _format_by_bookmarks(skeleton_doc, doc_model, rules)

    # Phase 3: Inject complex elements (images with positioning, shapes)
    _inject_complex_elements(skeleton_doc, doc_model, original_docx_path)

    # Phase 4: Apply global APA7 styling
    _apply_global_apa7_style(skeleton_doc, rules)

    skeleton_doc.save(str(output_path))


def _add_bookmark(paragraph, name):
    """Inserta bookmark para mapeo ID-based."""
    from lxml import etree
    p_element = paragraph._element
    bookmark_start = etree.SubElement(p_element, f'{NSMAP["w"]}bookmarkStart')
    bookmark_start.set(f'{NSMAP["w"]}name', name)
    bookmark_start.set(f'{NSMAP["w"]}id', str(hash(name) % 10000))
    bookmark_end = etree.SubElement(p_element, f'{NSMAP["w"]}bookmarkEnd')
    bookmark_end.set(f'{NSMAP["w"]}id', str(hash(name) % 10000))
```

---

## 7. PROBLEMA 6: UI/UX — REDISEÑO COMPLETO

### 7.1 Diagnóstico

- 90% inline styles — nightmare de mantenimiento
- 3 upload UIs separados (Step0QuickStart, Welcome, FileMenu)
- 2 DnD libraries (@dnd-kit + @hello-pangea/dnd)
- Monolítico Zustand store (60+ fields, 735 LOC)
- No responsive design (fixed pixel widths)
- No dark mode (CSS variables exist pero no toggle)
- Window titlebar buttons non-functional
- Preview "Original" toggle broken
- 4 download buttons simultaneously visible

### 7.2 Propuesta: UI Framework — Tailwind CSS 4 + shadcn/ui

**Justificación**:
- **Tailwind CSS 4**: Elimina 90% de inline styles, utility-first, responsive built-in
- **shadcn/ui**: Components accesibles, themeable, copy-paste (no dependency lock-in)
- **Radix UI primitives**: Accesibilidad built-in (keyboard nav, focus management)
- **Design tokens**: CSS variables para themes (light/dark/customizable)

**Layout Propuesto**:

```
┌─────────────────────────────────────────────────────────┐
│  WindowTitlebar │ UnifiedToolbar │ ProjectTabs           │
│  ┌──────┐ ┌─────────────────────┐ ┌──────────────────┐ │
│  │ Left │ │   Center Panel      │ │  Right Panel     │ │
│  │ Nav  │ │  Editor / Preview   │ │  Inspector /     │ │
│  │Pane  │ │  (switchable tabs)  │ │  Preview         │ │
│  └───────────────────────────────────────────────────┘ │
│  GuidedWizardBar │ StatusBar                             │
└─────────────────────────────────────────────────────────┘
```

**Unified Toolbar con Tabs (Home/Format/Review/View)**:

```tsx
export function UnifiedToolbar() {
  return (
    <Tabs defaultValue="home">
      <TabsList>
        <TabsTrigger value="home">Inicio</TabsTrigger>
        <TabsTrigger value="format">Formato</TabsTrigger>
        <TabsTrigger value="review">Revisión</TabsTrigger>
        <TabsTrigger value="view">Vista</TabsTrigger>
      </TabsList>
      <TabsContent value="home">
        <Button onClick={handleUpload}><FileUp /> Abrir</Button>
        <Button onClick={handleSave}><Save /> Guardar</Button>
        <Button onClick={handleExport}><Download /> Exportar APA7</Button>
      </TabsContent>
      <TabsContent value="review">
        <Button onClick={runLLMClassify}><Wand2 /> Clasificar con IA</Button>
        <Button onClick={validateCitations}><ShieldCheck /> Validar citas</Button>
      </TabsContent>
      <TabsContent value="view">
        <ToggleGroup value={previewMode} onChange={setPreviewMode}>
          <Toggle value="corrected">Corregido</Toggle>
          <Toggle value="original">Original</Toggle>
        </ToggleGroup>
      </TabsContent>
    </Tabs>
  );
}
```

**UploadDropzone** (reemplaza 3 upload UIs):

```tsx
export function UploadDropzone({ onFileSelected, accept = '.docx', maxSize = 50 * 1024 * 1024 }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <div className={cn(
      "border-2 border-dashed rounded-xl p-8 transition-all",
      dragging ? "border-primary bg-primary/10 scale-105" : "border-muted-foreground/30",
    )}>
      <FileUp className="h-12 w-12 text-muted-foreground" />
      <p className="text-lg font-medium">Arrastra tu documento .docx aquí</p>
      <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
      {progress > 0 && <Progress value={progress} className="w-full max-w-md" />}
    </div>
  );
}
```

### 7.3 Propuesta: Zustand Store Split

```typescript
// Slice: doc state + actions
export const useDocSlice = create<DocState>()(persist({...}, { name: 'wordapa7-doc' }));
// Slice: APA rules + preferences
export const useRulesSlice = create<RulesState>()(persist({...}, { name: 'wordapa7-rules' }));
// Slice: wizard progress + step state
export const useWizardSlice = create<WizardState>()({...});
// Slice: preview mode + PDF/PNG state
export const usePreviewSlice = create<PreviewState>()({...});
// Slice: LLM classification + progress
export const useLLMSlice = create<LLMState>()({...});
```

---

## 8. PROBLEMA 7: BUGS CRÍTICOS EXISTENTES

### Bug #1 [FATAL]: API Key UI Missing

**Fix**: Add API Key input to RibbonToolbar or PreferencesModal. Verify `load_dotenv()` path is correct.

### Bug #2 [FATAL]: needs_review=False Universal

**Fix**: See section 4.3 — Pass 3 must mark ambiguous elements as `needs_review=True` and not overwrite existing confident classifications.

### Bug #3 [CRITICAL]: Textbox Extraction Crash

**Fix**: Add type checking in `extract_textbox_paragraphs()`:
```python
for run in runs:
    if isinstance(run, str):
        para_text += run
    elif hasattr(run, 'text'):
        para_text += run.text or ''
```

### Bug #4 [CRITICAL]: Preview Response Format Mismatch

**Fix Backend**: Return `{status, mode, pages}` instead of `{html}`.
**Fix Frontend**: Handle both `png_pages` mode and `css` mode.

### Bug #5 [MEDIUM]: 4 Download Buttons

**Fix**: Consolidate to ONE location — UnifiedToolbar Home tab + Step6ExportWizard only.

### Bug #6 [MEDIUM]: bullet_style=None

**Fix**: Pass style arguments explicitly: `format_bullet_item(paragraph, element, bullet_style=rules.bullet_style)`.

---

## 9. TECNOLOGÍAS FALTANTES — Lo que el sistema NO tiene y DEBERÍA tener

### 9.1 Tecnologías Críticas Faltantes

| # | Tecnología | Área | Justificación | Prioridad |
|---|-----------|------|--------------|-----------|
| 1 | **pdf.js** | Preview | 100% fidelity PDF rendering in browser | 🔴 P0 |
| 2 | **WebSocket** | Real-time | Progress updates sin polling | 🟡 P1 |
| 3 | **Tailwind CSS 4 + shadcn/ui** | UI | Eliminar inline styles, responsive, accessible | 🟡 P1 |
| 4 | **PyMuPDF (fitz)** | Cover Preview | PDF → PNG extraction | 🟡 P1 |
| 5 | **scikit-learn** | Classification | DBSCAN clustering for headings | 🔴 P0 |
| 6 | **asyncio Queue + Workers** | Task Queue | Background processing for large docs | 🟡 P1 |
| 7 | **Hash-based Cache** | Preview | Avoid regenerating same preview | 🟡 P1 |
| 8 | **React Router** | Navigation | URL-based routing | 🟢 P2 |
| 9 | **i18n (react-intl)** | Internationalization | Multi-language support | 🟢 P3 |
| 10 | **Tauri** | Desktop | Electron alternative — lighter, Rust security | 🟢 P3 |
| 11 | **Zustand slices** | State | Split monolític store into domain slices | 🟢 P2 |
| 12 | **SQLite persistence** | Sessions | Replace JSON-on-disk | 🟢 P2 |
| 13 | **Docker** | Deployment | Consistent deployment with LibreOffice | 🟢 P2 |
| 14 | **CI/CD Pipeline** | DevOps | Automated testing | 🟢 P3 |
| 15 | **Error Boundaries** | Resilience | Graceful crash recovery | 🟡 P1 |
| 16 | **@tanstack/react-query** | API State | Caching + invalidation + loading states | 🟢 P2 |
| 17 | **structlog** | Logging | Structured JSON logging | 🟢 P3 |
| 18 | **Playwright E2E** | Testing | Integration test coverage | 🟡 P1 |

---

## 10. TECNOLOGÍAS SUPERADAS — "Estás haciendo X pero es mejor Y"

| # | Lo que HACE | Lo que DEBERÍA HACER | Razón | Impacto |
|---|-------------|---------------------|-------|---------|
| 1 | CSS inline preview (~60%) | **PDF.js rendering** (~99%) | CSS approximation vs pixel-perfect PDF | 🔴 CRITICAL |
| 2 | mammoth.js (NO usado) | **Eliminar o LibreOffice PDF** | mammoth low-fidelity HTML vs perfect PDF | 🟡 MEDIUM |
| 3 | subprocess.run LibreOffice | **Persistent listener + queue** | 3-8s cold start vs ~0.5s with listener | 🔴 CRITICAL |
| 4 | JSON session on disk | **SQLite database** | Slow for 200+ elements vs indexed queries | 🟡 MEDIUM |
| 5 | Paragraph-matching by position | **Bookmark-based matching** | Position fragil vs ID-based anchors | 🟡 MEDIUM |
| 6 | Inline styles `style={{}}` | **Tailwind CSS 4** | Unmaintainable vs utility-first responsive | 🔴 HIGH |
| 7 | Monolític Zustand store | **Zustand slices** | Coupling vs domain separation | 🟡 MEDIUM |
| 8 | 2 DnD libraries | **Single: @dnd-kit** | Confusion vs consistent API | 🟡 MEDIUM |
| 9 | Isolated paragraph rules | **Fingerprint clustering** | Misses context vs group-based detection | 🔴 HIGH |
| 10 | Shallow image extraction | **Recursive extraction** | Misses 3/6 cases vs full coverage | 🟡 MEDIUM |
| 11 | state-driven routing | **URL-based routing** | No navigation vs proper URLs | 🟡 MEDIUM |
| 12 | fetch polling for progress | **WebSocket streaming** | Delay vs instant updates | 🟡 MEDIUM |
| 13 | No Electron (SPA only) | **Tauri (Rust shell)** | 150MB overhead vs ~5MB Rust | 🟢 LOW |
| 14 | Spanish-only hardcoded | **i18n (react-intl)** | No localization vs multi-language | 🟢 LOW |
| 15 | No error boundaries | **React ErrorBoundary** | Total crash vs graceful recovery | 🟡 MEDIUM |
| 16 | No preview caching | **Hash-based cache** | 10-30s wasted vs instant | 🟡 MEDIUM |
| 17 | docx2pdf COM fallback | **LibreOffice-only** | Windows-only vs cross-platform | 🟢 LOW |
| 18 | No responsive design | **Tailwind responsive** | Fixed pixels vs adaptive | 🟡 MEDIUM |
| 19 | console error logging | **structlog** | Unstructured vs JSON filtering | 🟢 LOW |
| 20 | No test coverage | **pytest + Playwright E2E** | 3 basic tests vs full coverage | 🔴 HIGH |

---

## 11. PROPUESTAS DE IMPLEMENTACIÓN — Set Completo

### P1: Fast Import Pipeline (3-4 días) 🔴 P0

- Single-pass ZIP extraction
- `asyncio.to_thread()` para no bloquear event loop
- Defer AI detection to BackgroundTask
- Upload progress via XHR + WebSocket
- Target: upload <4s for 208-element doc

### P2: PDF Preview System (5-7 días) 🔴 P0

- `DocConverterService` con LibreOffice listener mode
- Conversion queue + hash-based cache
- `PDFPreview.tsx` component (pdf.js viewer)
- WebSocket progress streaming
- Cover preview via PyMuPDF
- CSS fallback for no-LibreOffice

**Dependencias nuevas**: `pdfjs-dist` (npm), `PyMuPDF` (pip)

### P3: Heading Clustering (3-5 días) 🔴 P0

- `StyleFingerprint` + `ClusteringHeadingClassifier` using DBSCAN
- Fix Pass 3 needs_review logic
- Integrate clustering as Pass 4

**Dependencias nuevas**: `scikit-learn>=1.5.0` (pip)

### P4: Recursive Image Extraction (2-3 días) 🟡 P1

- `extract_all_images_recursive()` using lxml `.iter()`
- Positioning extraction (wp:anchor)
- Caption association by proximity
- New `ElementType.CAPTION`

### P5: Hybrid Generator (4-5 días) 🟡 P1

- Bookmark-based paragraph matching
- Skeleton DOCX + inject complex elements
- Elimina position fragility

### P6: UI Redesign (7-10 días) 🟡 P1

- Tailwind CSS 4 + shadcn/ui
- UploadDropzone unified component
- PDFPreview (from P2)
- UnifiedToolbar with tabs
- Error boundaries
- Remove deprecated components
- Responsive breakpoints

**Dependencias nuevas**: `tailwindcss`, `@shadcn/ui`, `class-variance-authority`, `clsx`, `tailwind-merge`

### P7: Zustand Store Split (2-3 días) 🟢 P2

- 5 domain slices: doc, rules, wizard, preview, llm

### P8: WebSocket Real-time (2-3 días) 🟡 P1

- 3 WS endpoints: parse-progress, classify-progress, preview-progress
- Frontend WS client with auto-reconnect

### P9: SQLite Session Persistence (2-3 días) 🟢 P2

- Replace JSON-on-disk with indexed SQLite

### P10: Docker Deployment (1-2 días) 🟢 P2

- Docker image with LibreOffice pre-installed

### P11: Tauri Desktop Shell (5-7 días) 🟢 P3

- Rust-based desktop shell, ~5MB vs 150MB Electron

### P12: CI/CD Pipeline (1-2 días) 🟢 P3

- GitHub Actions: pytest + vitest + docker build

### P13: i18n (3-5 días) 🟢 P3

- react-intl for Spanish + English + Portuguese

### P14: Test Coverage (5-7 días) 🟡 P1

- pytest unit tests (80% coverage)
- Playwright E2E tests
- vitest component tests

### P15: Cover Detection (2-3 días) 🟡 P1

- Implement paragraph-based cover detection
- Multi-signal: body keywords + centered blocks + font patterns
- Cover preview via PyMuPDF

---

## 12. PLAN DE FASES — Roadmap

### F0: Bug Fixes (1-2 días) 🔴 URGENTE

| Bug | Fix | Estimación |
|-----|-----|-----------|
| #1 API Key missing | Add to RibbonToolbar + verify load_dotenv | 2h |
| #2 needs_review=False | Fix Pass 3 logic | 4h |
| #3 textbox crash | Add type checking | 2h |
| #4 preview format mismatch | Fix endpoint + frontend handler | 4h |
| #5 4 download buttons | Remove duplicates | 1h |
| #6 bullet_style None | Pass style arguments | 2h |

### F1: Fast Import (3-4 días) 🔴 P0
### F2: PDF Preview (5-7 días) 🔴 P0
### F3: Heading Clustering (3-5 días) 🔴 P0
### F4: Images + Cover (3-5 días) 🟡 P1
### F5: UI Redesign (7-10 días) 🟡 P1
### F6: Infrastructure (3-5 días) 🟢 P2
### F7: Polish (3-5 días) 🟢 P3

**Timeline Total**: 26-43 días (~4-7 semanas)

**Priorización**: F0 → F1+F2+F3 (parallelizable) → F4 → F5 → F6 → F7

---

## 13. ARQUITECTURA FINAL PROPUESTA

### Backend Architecture

```
┌──────────────────────────────────────────────────────┐
│  FastAPI Application                                  │
│  ├─ ParseService                                      │
│  │   ├─ _extract_zip_single_pass() — ONE ZIP open   │
│  │   ├─ asyncio.to_thread(parse_docx_bytes)          │
│  │   └─ BackgroundTask: AI detection deferred        │
│  ├─ DocConverterService                              │
│  │   ├─ LibreOffice listener (persistent socket)     │
│  │   ├─ asyncio.Queue + worker (sequential)          │
│  │   ├─ Hash-based cache (rules+portada+refs)        │
│  │   └─ PyMuPDF cover preview                       │
│  ├─ ClassificationService                            │
│  │   ├─ Pass 1: Format heuristics                    │
│  │   ├─ Pass 2: Hierarchy + numbering               │
│  │   ├─ Pass 3: Style fingerprint clustering (DBSCAN)│
│  │   ├─ Pass 4: Context refinement                   │
│  │   └─ LLM: Multi-provider async                   │
│  ├─ GenerationService                                │
│  │   ├─ Hybrid generator (bookmark anchors)          │
│  │   ├─ StyleEngine, ImageHandler, BulletEngine      │
│  ├─ SessionService                                   │
│  │   ├─ SQLite persistence                           │
│  │   ├─ Idempotency (SHA-256)                        │
│  ├─ WebSocketService                                 │
│  │   ├─ /ws/parse-progress                           │
│  │   ├─ /ws/classify-progress                        │
│  │   ├─ /ws/preview-progress                         │
│  └─ APA Modules                                      │
│     ├─ CitationEngine, APAValidator                  │
│     ├─ ReferenciasModule, PortadaModule              │
└──────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌──────────────────────────────────────────────────────┐
│  React 18 + TypeScript + Vite                        │
│  ├─ State: Zustand Slices                            │
│  │   ├─ useDocSlice (document + elements)            │
│  │   ├─ useRulesSlice (APA rules)                    │
│  │   ├─ useWizardSlice (progress + step)             │
│  │   ├─ usePreviewSlice (PDF/PNG + mode)             │
│  │   ├─ useLLMSlice (providers + progress)           │
│  ├─ UI: Tailwind CSS 4 + shadcn/ui                   │
│  │   ├─ Theme: light + dark (CSS variables)          │
│  │   ├─ Responsive: sm/md/lg/xl breakpoints          │
│  ├─ Components                                       │
│  │   ├─ Shell: WindowTitlebar, UnifiedToolbar, Tabs  │
│  │   ├─ Panels: NavigationOutline, EditorCanvas,     │
│  │   │           PDFPreview, Inspector               │
│  │   ├─ Upload: UploadDropzone (unified)             │
│  │   ├─ Wizard: Steps 0-6                            │
│  │   ├─ Shared: Toast, Badge, Progress, ErrorBoundary│
│  ├─ API: REST + WebSocket + XHR upload progress      │
│  ├─ Routing: react-router-dom                        │
│  │   ├─ / → Step0QuickStart                          │
│  │   ├─ /editor/:sessionId → Document editor         │
│  └─ PDF rendering: pdf.js (Mozilla)                  │
└──────────────────────────────────────────────────────┘
```

### Integration Architecture

```
┌───────────┐     ┌───────────┐     ┌───────────────────┐
│  Tauri/   │     │  React    │     │  FastAPI          │
│  Browser  │────▶│  SPA      │────▶│  Backend          │
│  Shell    │     │  (Vite)   │     │  (Python)         │
└───────────┘     └───────────┘     └───────────────────┘
                                        │
                    ┌───────────────────┼───────────────┐
                    ▼                   ▼               ▼
              ┌──────────┐     ┌──────────────┐  ┌──────────┐
              │ LibreOf- │     │  LLM APIs    │  │ SQLite   │
              │ fice     │     │  (8 providers│  │ DB       │
              │ Listener │     │  parallel)   │  │          │
              └──────────┘     └──────────────┘  └──────────┘
                    │
                    ▼
              ┌──────────┐
              │  PDF     │ ← pdf.js renders in frontend
              │  Cache   │
              └──────────┘
```

---

## APÉNDICE A: DEPENDENCIES COMPLETE LIST

### Python (pip)

```
# Core (existing)
fastapi>=0.111.0
uvicorn[standard]>=0.30.1
python-docx>=1.1.2
lxml>=5.2.0
pillow>=10.4.0
python-multipart>=0.0.9
httpx>=0.27.0
openai>=1.35.0
pydantic>=2.7.4
pydantic-settings>=2.3.4
aiofiles>=23.2.1
python-dotenv>=1.0.1

# NEW — Proposed
scikit-learn>=1.5.0        # Heading clustering (DBSCAN)
PyMuPDF>=1.24.0            # Cover preview PDF→PNG
structlog>=24.1.0          # Structured logging
```

### Node.js (npm)

```json
{
  "dependencies": {
    // Core (existing)
    "react": "^18.3",
    "react-dom": "^18.3",
    "zustand": "^4.5",
    "lucide-react": "^0.395",
    "@dnd-kit/core": "^6.1",
    "@dnd-kit/sortable": "^8.0",

    // REMOVE (replaced)
    // "@hello-pangea/dnd" → consolidated to @dnd-kit
    // "mammoth" → replaced by LibreOffice PDF

    // NEW — Proposed
    "pdfjs-dist": "^4.0",
    "tailwindcss": "^4.0",
    "@shadcn/ui": "latest",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.2",
    "react-intl": "^6.6",
    "@tanstack/react-query": "^5.51",
    "sonner": "^1.5"
  }
}
```

---

## APÉNDICE B: ARCHIVOS NUEVOS A CREAR

| Archivo | Propuesta | LOC estimado |
|---------|----------|-------------|
| `python/services/doc_converter_service.py` | P2: LibreOffice persistent | ~200 |
| `python/services/parse_service.py` | P1: Async parse pipeline | ~150 |
| `python/classification/clustering_classifier.py` | P3: Fingerprint clustering | ~250 |
| `python/parsing/image_extractor_recursive.py` | P4: Recursive image extraction | ~180 |
| `python/generation/hybrid_generator.py` | P5: Bookmark-based generator | ~300 |
| `src/components/preview/PDFPreview.tsx` | P2: PDF.js viewer | ~250 |
| `src/components/preview/CSSPreviewFallback.tsx` | P2: CSS fallback | ~180 |
| `src/components/upload/UploadDropzone.tsx` | P6: Unified upload | ~120 |
| `src/components/toolbar/UnifiedToolbar.tsx` | P6: Tab toolbar | ~200 |
| `src/store/useDocSlice.ts` | P7: Doc slice | ~150 |
| `src/store/useRulesSlice.ts` | P7: Rules slice | ~80 |
| `src/store/useWizardSlice.ts` | P7: Wizard slice | ~60 |
| `src/store/usePreviewSlice.ts` | P7: Preview slice | ~100 |
| `src/store/useLLMSlice.ts` | P7: LLM slice | ~80 |
| `src/api/websocket.ts` | P8: WS client | ~80 |
| `src/styles/theme.css` | P6: Theme tokens | ~60 |
| `Dockerfile` | P10: Docker | ~40 |
| `docker-compose.yml` | P10: Compose | ~30 |

---

## APÉNDICE C: CHECKLIST DE IMPLEMENTACIÓN

### Pre-Implementation (F0)

- [ ] API Key input funcional en UI activa
- [ ] `load_dotenv()` path verified
- [ ] `needs_review=True` triggers properly
- [ ] Textbox extraction no crashea
- [ ] Preview endpoint format correcto
- [ ] Solo 1 download button visible
- [ ] bullet_style/num_style pasados correctamente

### Per-Phase

- [ ] F1: Upload time <4s for 208-element doc
- [ ] F2: Preview renders 100% fidelity PDF/PNG
- [ ] F2: LibreOffice persistent service running
- [ ] F2: Cover preview shows real PNG
- [ ] F3: Clustering produces distinct heading groups
- [ ] F3: needs_review=True count >0
- [ ] F4: Floating images detected with positioning
- [ ] F4: Grouped shapes images extracted
- [ ] F4: Captions associated by proximity
- [ ] F5: No inline styles remaining (all Tailwind)
- [ ] F5: Dark mode toggle functional
- [ ] F5: Single UploadDropzone component
- [ ] F6: WebSocket progress working
- [ ] F6: Zustand split into 5 slices
- [ ] F6: SQLite session persistence
- [ ] F6: Docker image builds and runs

### Post-Implementation

- [ ] All 208-element doc test passes end-to-end
- [ ] Import <4s, Preview <5s, Classify <30s
- [ ] Cover detection works for textbox AND paragraph covers
- [ ] No regression in simple documents
- [ ] API keys configurable from UI
- [ ] Security: no API keys in git-tracked files
- [ ] Accessibility: keyboard navigation
- [ ] Error boundaries: graceful recovery

---

**FIN DEL MEGAPROMPT**

> Este documento es autocontenido y puede ser pasado directamente a una IA (Gemini, Claude, GPT) para implementación.
> Cada sección tiene código de ejemplo, diagnósticos con line references, y estimaciones de tiempo.
> Las fases F0-F7 pueden implementarse secuencialmente o con F1+F2+F3 en paralelo.
