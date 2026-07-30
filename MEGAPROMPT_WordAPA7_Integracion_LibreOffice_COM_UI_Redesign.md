# MEGA-PROMPT: WordAPA7 — Integración LibreOffice/COM + Rediseño UI + Mejoras Estructurales

> **Versión**: 2.0 | **Fecha**: 2026-07-25
> **Destino**: IA programadora que va a implementar los cambios
> **Proyecto**: WordAPA7 (FastAPI + React 18 + TypeScript + Vite + Zustand)
> **Prioridad**: Calidad > Velocidad. Un solo usuario concurrente.

---

## SECCIÓN 0: RESUMEN EJECUTIVO RÁPIDO

Este megaprompt atacar 3 grandes problemas:

1. **Preview falla** — La integración COM/LibreOffice está mal hecha: `PDFPreview.tsx` solo carga 1 vez y nunca se refresca, `doc_converter.py` tiene bug de indentación que mezcla bloques elif/else, `lo_service.py` mezcla listener mode con CLI mode (race condition), la URL del PDF está hardcoded a `127.0.0.1:8742`.

2. **UI no intuitiva** — El wizard de 7 pasos + RibbonToolbar + Panel inspector + OutlinePane + PaperCanvas + LivePreview/PDFPreview = demasiado, todo visible al mismo tiempo, sin flujo claro. El toggle "Original/Corregido" está invertido (Corregido = PDFPreview, Original = CSS), iconos Eye/EyeOff no matchean la acción.

3. **Estructura del backend débil** — No hay `page_layout_provider.py` (el plan COM lo propuso pero nunca se implementó), `post_processor.py` no existe (doc_converter.py lo importa), la caché PDF nunca se invalida, el export wizard no ofrece PDF.

---

## SECCIÓN 1: AUDITORÍA DE BUGS — LO QUE ESTÁ MAL AHORA

### 1.1 BUGS CRÍTICOS (BLOCKER — el sistema no funciona correctamente)

#### BUG-B1: PDFPreview solo renderiza 1 vez, nunca se refresca

**Archivo**: `src/components/layout/PDFPreview.tsx` líneas 50-54
**Problema**: El `useEffect` tiene dependency array `[]` — solo corre on mount. Cuando el usuario edita texto, cambia rules, o modifica portada, el PDF preview nunca se actualiza. La caché hash existe pero nadie la invalida.
**Impacto**: El usuario ve el PDF del documento inicial y nunca ve los cambios que hace.

**FIX**: Agregar dependencies al useEffect + invalidación de caché:
```typescript
useEffect(() => {
  fetchPdfPreview();
}, [doc?.session_id, doc?.elements, rules, portada, references.length]);
// También invalidar pdfPreviewCache cuando cambie cualquier campo relevante
```

#### BUG-B2: doc_converter.py tiene bug de indentación/estructura

**Archivo**: `python/services/doc_converter.py` líneas 63-81
**Problema**: El bloque `elif engine == "LO":` está mal indentado. El `if generate_pdf:` que debería estar dentro del elif está DENTRO del `with self._lock:` pero FUERA del elif, y el `else:` en línea 78 corresponde al if exterior, no al elif. Esto significa que si engine=="NONE", el código del LO path podría ejecutarse incorrectamente.

**FIX**: Reindentar completamente `process_and_convert()`:
```python
def process_and_convert(self, original_path, generated_path, final_path,
                         preserve_cover=False, generate_pdf=True):
    with self._lock:
        engine = self.get_active_engine()

        if engine == "COM":
            return self._com_processor.process(
                original_path, generated_path, final_path,
                preserve_cover=preserve_cover, generate_pdf=generate_pdf
            )
        elif engine == "LO":
            shutil.copy(generated_path, final_path)
            if generate_pdf:
                success = self._lo_service.convert(final_path, "pdf", final_path.parent)
                if success:
                    pdf_path = final_path.with_suffix(".pdf")
                    return True, pdf_path
                return False, None
            return True, None
        else:  # NONE
            shutil.copy(generated_path, final_path)
            return False, None
```

#### BUG-B3: lo_service.py mezcla listener + CLI (race condition)

**Archivo**: `python/services/lo_service.py`
**Problema**: `start()` arranca LibreOffice en listener mode (--accept=socket, port=2002), pero `convert()` usa `subprocess.run()` con `--convert-to` que arranca una INSTANCIA NUEVA que conflictúa con el listener. LibreOffice en listener mode NO acepta comandos CLI via subprocess; necesita conectarse via UNO/PyUNO.

**FIX**: Eliminar el listener approach. Usar solo CLI conversion con singleton lock:
```python
class LibreOfficeService:
    def __init__(self):
        self._lock = threading.Lock()
        self._lo_path = shutil.which('libreoffice') or shutil.which('soffice')

    def is_available(self) -> bool:
        return self._lo_path is not None

    def convert(self, input_path, output_format, output_dir) -> bool:
        if not self.is_available():
            return False
        with self._lock:
            result = subprocess.run(
                [self._lo_path, '--headless', '--norestore',
                 '--convert-to', output_format,
                 '--outdir', str(output_dir.resolve()),
                 str(input_path.resolve())],
                capture_output=True, timeout=60
            )
            return result.returncode == 0
```

#### BUG-B4: PDFPreview URL hardcoded

**Archivo**: `src/components/layout/PDFPreview.tsx` línea 37
**Problema**: `http://127.0.0.1:8742` hardcoded. Rompe en producción, en otros hosts, y en Electron donde el servidor corre en puerto variable.

**FIX**: Usar URL relativa o window.location.origin:
```typescript
const newUrl = `${window.location.origin}${res.download_url}?t=${Date.now()}`;
// O simplemente relativa (el iframe puede cargar same-origin):
const newUrl = `${res.download_url}?t=${Date.now()}`;
```

#### BUG-B5: `generation/post_processor.py` NO EXISTE

**Archivo**: `python/services/doc_converter.py` línea 9
**Problema**: `from generation.post_processor import get_com_post_processor` — este módulo no existe en el proyecto. Ni en v1 ni en v2. El import crashea el servidor al inicio.

**FIX**: Crear `python/generation/post_processor.py` con COM post-processor, o si COM no está disponible, crear stub que retorna un objeto con `is_available() → False` y `process() → (False, None)`.

#### BUG-B6: asyncio no importado en main.py

**Archivo**: `python/main.py` línea ~1199
**Problema**: `await asyncio.sleep(1.0)` pero `asyncio` nunca se importa.
**FIX**: Agregar `import asyncio` al inicio de main.py.

#### BUG-B7: Middleware X-Request-ID duplicado

**Archivo**: `python/main.py` líneas ~1687 y ~1707
**Problema**: `debug_logging_middleware` y `request_id_middleware` ambos generan UUID y setean `X-Request-ID` en response. Dos IDs diferentes se generan, el final depende del orden.
**FIX**: Eliminar `request_id_middleware` y que `debug_logging_middleware` maneje todo.

### 1.2 BUGS DE UI (funcionalidad incorrecta)

#### BUG-U1: Toggle Original/Corregido invertido

**Archivo**: `src/components/layout/LivePreview.tsx` líneas 146-160
**Problema**: "Corregido" renderiza `<PDFPreview />` (100% fiel, render real), "Original" renderiza CSS (aproximación ~60%). Pero los iconos están invertidos: "Original" usa Eye (mostrar), "Corregido" usa EyeOff (ocultar). El nombre "Original" sugiere el documento original sin cambios, pero muestra CSS (aproximación de APA). "Corregido" sugiere el documento corregido con APA aplicado, pero muestra PDF (render real).

**FIX**: Redesignar el toggle. Eliminar la dualidad confusa. Usar tabs claros:
- Tab "Documento APA" → PDFPreview (render 100% fiel del resultado)
- Tab "Esquema" → CSS outline (vista rápida del structure, no pretende ser render)

#### BUG-U2: Step6ExportWizard no ofrece descarga PDF

**Archivo**: `src/components/wizard/Step6ExportWizard.tsx`
**Problema**: Solo ofrece 2 botones: DESCARGAR DOCX y DESCARGAR CON TRACKED CHANGES. No hay botón de PDF. El endpoint `/api/generate-pdf` existe en backend pero no se usa en el paso de export.

**FIX**: Agregar botón "DESCARGAR PDF" que llama `/api/generate-pdf`.

#### BUG-U3: "Niveles 1, 2, 3" hardcoded

**Archivo**: `src/components/wizard/Step6ExportWizard.tsx` línea 60
**Problema**: `{totalHeadings} Niveles 1, 2, 3` hardcoded. Si el documento tiene niveles 4-5, muestra info incorrecta.
**FIX**: Calcular dinámicamente los niveles presentes: `{levelsPresent.join(', ')}`.

#### BUG-U4: PDFPreview height hardcoded 600px

**Archivo**: `src/components/layout/PDFPreview.tsx` línea 57
**Problema**: `height: '600px'` fijo. No se adapta al panel inspector (320px) ni al viewport completo.
**FIX**: Usar `height: '100%'` con flex layout del parent.

---

## SECCIÓN 2: REDESIGN DE UI — FLUJO INTUITIVO

### 2.1 Problema fundamental del UI actual

El UI actual tiene **demasiados paneles simultáneos** sin un flujo claro:

```
┌─────────────────────────────────────────────────────┐
│ WindowTitlebar │ RibbonToolbar (4+ botones APA)     │
├────────┬──────────────────────────┬─────────────────┤
│ Outline│ PaperCanvas (editor)     │ Inspector/Preview│
│ Pane   │ (element cards)          │ (toggle O/C)     │
│        │                          │ + CoverDesigner  │
│        │                          │ + Step0Prefs     │
│        │ WizardBar (7 steps)      │ + NIMDiagnostic  │
├────────┴──────────────────────────┴─────────────────┤
│ StatusBar (4 indicadores)                            │
└─────────────────────────────────────────────────────┘
```

El usuario no sabe qué hacer primero. El wizard está siempre visible como barra pero no guía el flujo. El PaperCanvas, Inspector, y Preview están siempre visibles simultáneamente. Hay 4+ botones de descarga APA7 visibles al mismo tiempo.

### 2.2 Propuesta: UI tipo "Editor APA" con modo dual

Redesignar a un flujo claro en 2 modos:

**Modo EDICIÓN** (izquierda: outline + editor, derecha: inspector)
**Modo RESULTADO** (full-width: PDF preview del documento APA final)

```
┌─────────────────────────────────────────────────────┐
│ ┌─WindowTitle───────────────────────────────────┐   │
│ │ WordAPA7 │ [Editar] [Ver Resultado] │ ─ │ □ │   │
│ ├───────────────────────────────────────────────┤   │
│ │ 📋 [Abrir] │ [Guardar] │ [⚙ Config] │ [🤖 IA]│   │
│ └───────────────────────────────────────────────┤   │
│                                                       │
│ ═══ MODO EDICIÓN ═══════════════════════════════════  │
│                                                       │
│ ┌─Outline──┬─Canvas (Element Cards)────┬─Inspector─┐ │
│ │ 📑 Outline│ │                         │ │ Elemento │ │
│ │ │ H1 Intro│ │ ┌───────────────────┐ │ │ tipo: H2 │ │
│ │ │ H2 Marco│ │ │ [Card: Heading]  │ │ │ nivel: 2 │ │
│ │ │ H3 Sub  │ │ │ [Card: Parrafo]  │ │ │ bold: ✅ │ │
│ │ │ P body  │ │ │ [Card: Figura]   │ │ │ text: ...│ │
│ │ │ Img fig │ │ │                   │ │ │          │ │
│ │ │         │ │ │                   │ │ │ [Cambiar]│ │
│ └──────────┴─┴───────────────────────┴─┴──────────┘ │
│                                                       │
│ ═══ MODO RESULTADO ══════════════════════════════════ │
│                                                       │
│ ┌─PDF Preview (100% ancho)────────────────────────┐ │
│ │                                                  │ │
│ │  [iframe: PDF renderizado por LO/COM]           │ │
│ │  • Paginación real                              │ │
│ │  • Portada fiel                                 │ │
│ │  • Fuentes correctas                            │ │
│ │  • Click para zoom                              │ │
│ │                                                  │ │
│ │  [Actualizar Preview] [⬇ Descargar DOCX] [⬇ PDF]│ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─Status──┬─Motor: COM ✓ │ Páginas: 12 │ │ ────── │ │
│ └─────────────────────────────────────────────────────┘
```

### 2.3 Cambios concretos por componente

#### Componente nuevo: `ModeSwitch.tsx`
- Toggle entre "Editar" y "Ver Resultado" en la toolbar
- En modo Edición: Outline + Canvas + Inspector (layout 3-columnas)
- En modo Resultado: PDFPreview full-width + botones de descarga
- Estado del modo en Zustand store (`viewMode: 'edit' | 'result'`)

#### Redesignar `RibbonToolbar.tsx`
- Reducir a 4 acciones principales: Abrir documento, Guardar sesión, Configurar APA, IA/NIM
- Eliminar botones redundantes de descarga APA (4 botones → 0 en toolbar, solo en modo Resultado)
- Agregar toggle Modo Edición/Resultado

#### Redesignar `LivePreview.tsx` → eliminar
- Reemplazar completamente por `PDFPreview.tsx` en modo Resultado
- Eliminar el toggle Original/Corregido confuso
- La vista "Esquema" (outline) ya existe en `DocumentOutlinePane.tsx` en modo Edición
- No necesitamos un CSS preview de ~60% fidelidad cuando tenemos PDF de 100%

#### Redesignar `Step6ExportWizard.tsx`
- Agregar 3 botones claros: DESCARGAR DOCX, DESCARGAR PDF, DESCARGAR TRACKED CHANGES
- Cada botón llama su endpoint correspondiente
- Agregar preview del documento final (PDFPreview embebido)

#### Simplificar `StatusBar.tsx`
- Mostrar: Motor activo (COM ✓ / LO ✓ / Heurística), Total páginas, Total elementos, Proveedor IA
- Eliminar indicadores redundantes

---

## SECCIÓN 3: MEJORAS ESTRUCTURALES DEL BACKEND

### 3.1 Crear `python/generation/post_processor.py`

Este módulo es referenciado por `doc_converter.py` pero no existe. Debe implementar:

```python
# python/generation/post_processor.py

import os
import sys
import logging
import threading
from pathlib import Path
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

class COMPostProcessor:
    """Post-procesador via COM (Word Automation).
    
    Funciones:
    1. Trasplante quirúrgico de portada: abrir original + generado,
       copiar párrafos de portada del original al generado con fidelidad exacta.
    2. Generación de TOC: invocar Word.Fields.Update para regenerar tabla de contenidos.
    3. Conversión a PDF via Word.SaveAs2 con wdFormatPDF.
    """
    
    def is_available(self) -> bool:
        if sys.platform != "win32":
            return False
        try:
            import win32com.client
            return True
        except ImportError:
            return False
    
    def process(self, original_path, generated_path, final_path,
                preserve_cover=False, generate_pdf=True) -> Tuple[bool, Optional[Path]]:
        if not self.is_available():
            return False, None
        
        import pythoncom
        import win32com.client
        
        pythoncom.CoInitialize()
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        
        try:
            if preserve_cover:
                self._transplant_cover(word, original_path, generated_path, final_path)
            else:
                # Simplemente copiar el generado
                import shutil
                shutil.copy(generated_path, final_path)
            
            pdf_path = None
            if generate_pdf:
                pdf_path = self._convert_to_pdf(word, final_path)
            
            return True, pdf_path
        except Exception as e:
            logger.error(f"[COMPostProcessor] Error: {e}")
            return False, None
        finally:
            try:
                word.Quit()
            except:
                pass
            pythoncom.CoUninitialize()
            self._kill_orphan_winword()
    
    def _transplant_cover(self, word, original_path, generated_path, final_path):
        """Abre original y generado, copia portada del original al generado."""
        # Implementación detallada en plan_com_portada.md sección 5.4
        # ... (ver abajo)
    
    def _convert_to_pdf(self, word, docx_path) -> Optional[Path]:
        """Convierte DOCX → PDF via Word.SaveAs2."""
        doc = word.Documents.Open(str(docx_path.resolve()), ReadOnly=True)
        pdf_path = docx_path.with_suffix(".pdf")
        # wdFormatPDF = 17
        doc.SaveAs2(str(pdf_path.resolve()), FileFormat=17)
        doc.Close(SaveChanges=False)
        return pdf_path if pdf_path.exists() else None
    
    def _kill_orphan_winword(self):
        if sys.platform != "win32":
            return
        try:
            import subprocess
            subprocess.run(["taskkill", "/F", "/IM", "WINWORD.EXE", "/T"],
                           capture_output=True, timeout=5)
        except:
            pass

# Singleton
_com_post_processor = COMPostProcessor()

def get_com_post_processor() -> COMPostProcessor:
    return _com_post_processor
```

### 3.2 Crear `python/parsing/page_layout_provider.py`

El plan COM lo propuso pero nunca se implementó. Este módulo es CRÍTICO para detección precisa de portada:

```python
# python/parsing/page_layout_provider.py

from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass
import sys
import shutil

@dataclass
class PageLayoutResult:
    paragraph_pages: list[int]  # Para cada párrafo, su número de página (1-indexed)
    total_pages: int
    provider_used: str  # "com" | "libreoffice" | "heuristic"
    confidence: float  # 1.0 COM, 0.95 LO, 0.5 heuristic
    notes: list[str]

class PageLayoutProvider(ABC):
    @abstractmethod
    def paginate(self, docx_path: Path, timeout_seconds: int = 30) -> PageLayoutResult:
        pass
    @abstractmethod
    def is_available(self) -> bool:
        pass

class COMPageLayoutProvider(PageLayoutProvider):
    """Usa Word.Application via pywin32 para paginación exacta."""
    # Ver plan_com_portada.md sección 4.3.1 para implementación completa
    # ...

class LibreOfficePageLayoutProvider(PageLayoutProvider):
    """Convierte DOCX → PDF via LO, luego usa PyMuPDF para mapeo párrafo→página."""
    # Ver plan_com_portada.md sección 4.3.2 para implementación completa
    # ...

class HeuristicPageLayoutProvider(PageLayoutProvider):
    """Fallback: estimación por word_count (precisión ~70%)."""
    # Ver plan_com_portada.md sección 4.3.3 para implementación completa
    # ...

def get_page_layout_provider() -> PageLayoutProvider:
    """Factory con cascada: COM → LO → Heurística."""
    com = COMPageLayoutProvider()
    if com.is_available():
        return com
    lo = LibreOfficePageLayoutProvider()
    if lo.is_available():
        return lo
    return HeuristicPageLayoutProvider()
```

### 3.3 Conectar page_layout_provider al pipeline

3 puntos de conexión (del plan COM):

**Punto 1: `docx_parser.py` — `parse_docx_bytes()`**
```python
# Después de pre_classify_elements(), antes de return:
from parsing.page_layout_provider import get_page_layout_provider

provider = get_page_layout_provider()
layout_result = provider.paginate(docx_path, timeout_seconds=30)
doc_model.page_layout = layout_result
doc_model.page_count = layout_result.total_pages  # EXACTO, no estimado
```

**Punto 2: `pre_classifier.py` — Pasada 2**
```python
# Usar layout_result.paragraph_pages para determinar portada_boundary EXACTO:
if layout_result and layout_result.confidence >= 0.9:
    # Los párrafos que están en páginas 1..N (portada) se marcan como portada_block
    cover_end_page = determine_cover_end_page(layout_result.paragraph_pages, elements)
    portada_boundary = idx del primer párrafo en página cover_end_page + 1
```

**Punto 3: `generator.py` — `generate_apa7_docx()`**
```python
# Usar layout_result para cover_paragraph_count EXACTO:
if doc_model.page_layout and doc_model.page_layout.confidence >= 0.9:
    cover_paragraph_count = sum(
        1 for p in doc_model.page_layout.paragraph_pages[:idx]
        if p <= cover_end_page
    )
```

### 3.4 Crear `python/services/__init__.py`

**Archivo que falta**: `python/services/__init__.py`
```python
from services.lo_service import get_libreoffice_service, LibreOfficeService
from services.doc_converter import get_doc_converter, DocConverterService
```

### 3.5 Clustering de headings (huella de estilo)

Implementar `python/parsing/style_fingerprint.py` (propuesta del análisis anterior):

```python
# python/parsing/style_fingerprint.py

from dataclasses import dataclass
from typing import List, Dict, Tuple
from models import ElementModel, ElementType
import re

@dataclass
class StyleFingerprint:
    is_bold: bool
    is_italic: bool
    alignment: str  # 'center', 'left', 'right', 'justify'
    font_size_bucket: str  # 'large', 'medium', 'small'
    has_indent: bool
    ends_with_period: bool
    word_count_bucket: str  # 'short', 'medium', 'long'
    
    def key(self) -> str:
        return f"{self.is_bold}|{self.is_italic}|{self.alignment}|{self.font_size_bucket}|{self.has_indent}|{self.ends_with_period}|{self.word_count_bucket}"

def compute_fingerprint(elem: ElementModel, median_font: float) -> StyleFingerprint:
    text = (elem.text or "").strip()
    words = text.split()
    word_count = len(words)
    
    return StyleFingerprint(
        is_bold=elem.is_bold,
        is_italic=elem.is_italic,
        alignment=elem.alignment,
        font_size_bucket='large' if elem.font_size > median_font + 2
                        else 'small' if elem.font_size < median_font - 2
                        else 'medium',
        has_indent=elem.left_indent_cm >= 0.5,
        ends_with_period=text.rstrip().endswith('.'),
        word_count_bucket='short' if word_count <= 12
                         else 'medium' if word_count <= 25
                         else 'long',
    )

def cluster_heading_candidates(elements: List[ElementModel], median_font: float) -> Dict[str, List[ElementModel]]:
    """Agrupa párrafos candidatos a heading por huella de estilo idéntica."""
    candidates = [
        e for e in elements
        if e.text and e.text.strip()
        and e.type not in (ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE,
                          ElementType.PAGE_BREAK, ElementType.SECTION_BREAK, ElementType.TOC)
        and not e.is_cover_section
    ]
    
    clusters: Dict[str, List[ElementModel]] = {}
    for e in candidates:
        fp = compute_fingerprint(e, median_font)
        # Solo clusters donde el fingerprint sugiere heading
        heading_score = fp_heading_score(fp)
        if heading_score >= 0.3:  # Mínimo threshold para candidato
            key = fp.key()
            clusters.setdefault(key, []).append(e)
    
    # Filtrar clusters con ≥2 miembros
    return {k: v for k, v in clusters.items() if len(v) >= 2}

def fp_heading_score(fp: StyleFingerprint) -> float:
    score = 0.0
    if fp.is_bold: score += 0.4
    if fp.word_count_bucket == 'short': score += 0.2
    if not fp.ends_with_period: score += 0.1
    if fp.font_size_bucket == 'large': score += 0.2
    if fp.alignment == 'center': score += 0.15
    if fp.word_count_bucket == 'long': score -= 0.5
    return score

def determine_cluster_level(cluster_key: str, elements: List[ElementModel]) -> int:
    """Determina el nivel jerárquico de un cluster usando prioridad múltiple."""
    fp = compute_fingerprint(elements[0], 0)  # Solo para extraer atributos
    
    # (a) Numeración explícita
    for e in elements:
        text = (e.text or "").strip()
        if re.match(r'^\d+\.\d+\.\d+\s', text): return 3
        if re.match(r'^\d+\.\d+\s', text): return 2
        if re.match(r'^\d+\.\s', text): return 1
    
    # (b) Keywords académicas → H1
    HEADING1_KEYWORDS = {
        "introduccion", "conclusion", "conclusiones", "marco teorico",
        "metodologia", "resultados", "referencias", "bibliografia",
        "resumen", "abstract", "anexos",
    }
    for e in elements:
        text_norm = e.text.strip().lower().rstrip(".:;,")
        if text_norm in HEADING1_KEYWORDS:
            return 1
    
    # (c) Alineación centrada → H1
    if fp.alignment == 'center':
        return 1
    
    # (d) Bold + italic → H3
    if fp.is_bold and fp.is_italic:
        return 3
    
    # (e) Bold sin italic, izquierda → H2
    if fp.is_bold and not fp.is_italic:
        return 2
    
    return 2  # Default
```

### 3.6 Integrar clustering en pre_classifier.py

Modificar `pre_classify_elements()` para usar clustering en Pasada 3:

```python
# En pre_classifier.py, Pasada 3:

from parsing.style_fingerprint import cluster_heading_candidates, determine_cluster_level, compute_fingerprint

# ... calcular median_size como antes ...

# CLUSTERING: agrupar heading candidates
clusters = cluster_heading_candidates(elements, median_size)

# Para cada cluster, determinar nivel y confidence
for cluster_key, cluster_elems in clusters.items():
    level = determine_cluster_level(cluster_key, cluster_elems)
    
    # Calcular confidence del cluster
    fp_scores = [fp_heading_score(compute_fingerprint(e, median_size)) for e in cluster_elems]
    avg_score = sum(fp_scores) / len(fp_scores)
    confidence = min(0.95, 0.70 + avg_score * 0.25)
    
    # Asignar a todos los elementos del cluster
    for e in cluster_elems:
        e.type = ElementType.HEADING
        e.heading_level = level
        e.confidence = confidence
        e.needs_review = confidence < 0.80
    
    # Si confidence en zona gris, solo esos clusters van a NIM
    if 0.4 <= avg_score < 0.7:
        for e in cluster_elems:
            e.needs_review = True
            e.confidence = 0.65
```

---

## SECCIÓN 4: MEJORAS DE IMÁGENES (3 casos faltantes)

### 4.1 Imágenes dentro de wpg:wgp (shapes agrupados)

**Archivo**: `python/parsing/docx_parser.py`

```python
# Después de buscar a:blip y v:imagedata en p._element (línea 687-698):
# Agregar búsqueda recursiva dentro de shapes agrupados

WPG_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup'
WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

# Imágenes dentro de shapes agrupados (wpg:wgp → wsp → a:blip)
group_shapes = p._element.findall(f'.//{{{WPG_NS}}}wgp')
for wgp in group_shapes:
    # Buscar wsp dentro del grupo
    for wsp in wgp.findall(f'.//{{{WPS_NS}}}wsp'):
        blips_in_shape = wsp.findall(f'.//{{{A_NS}}}blip')
        for b in blips_in_shape:
            r_id = b.attrib.get(f'{{{R_NS}}}embed')
            if r_id and r_id not in blip_ids:  # Evitar duplicados
                blip_ids.append(r_id)
```

### 4.2 Capturar atributos de wp:anchor (flotante)

**Archivo**: `python/parsing/docx_parser.py` + `python/models.py`

Agregar campos a ImageModel:
```python
# models.py — ImageModel nuevos campos:
is_anchor: bool = False
anchor_position_h: Optional[str] = None  # 'left', 'center', 'right'
anchor_position_v: Optional[str] = None  # 'top', 'middle', 'bottom'
wrap_style: Optional[str] = None  # 'none', 'square', 'tight', 'topAndBottom'
```

En docx_parser.py, al procesar imágenes:
```python
# Detectar si la imagen es anchor vs inline
WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
drawing = p._element.find(f'.//{{{WP_NS}}}drawing')  # o iter si múltiples

if drawing is not None:
    anchor = drawing.find(f'{{{WP_NS}}}anchor')
    if anchor is not None:
        img_model.is_anchor = True
        pos_h = anchor.find(f'{{{WP_NS}}}positionH')
        pos_v = anchor.find(f'{{{WP_NS}}}positionV')
        if pos_h is not None:
            align = pos_h.find(f'{{{WP_NS}}}align')
            if align is not None:
                img_model.anchor_position_h = align.text
        # Detectar wrap style
        for wrap_tag in ['wrapSquare', 'wrapTight', 'wrapTopAndBottom', 'wrapNone']:
            wrap = anchor.find(f'{{{WP_NS}}}{wrap_tag}')
            if wrap is not None:
                img_model.wrap_style = wrap_tag.replace('wrap', '').lower()
                break
```

### 4.3 Asociación "Figura N" por proximidad

**Archivo**: `python/parsing/pre_classifier.py` — Pasada 2

```python
# Después de numerar figuras (líneas 530-535), agregar:

REGEX_FIGURE_CAPTION = re.compile(r'^(?:Figura|Figure|Fig\.)\s+\d+\.?', re.IGNORECASE)

for idx, elem in enumerate(elements):
    if elem.type == ElementType.IMAGE and elem.image_info:
        fig_num = elem.image_info.figure_number
        # Buscar caption arriba (idx-1) o abajo (idx+1), ±2 posiciones
        for offset in [-1, 1, -2, 2]:
            neighbor_idx = idx + offset
            if 0 <= neighbor_idx < len(elements):
                neighbor = elements[neighbor_idx]
                if neighbor.text and REGEX_FIGURE_CAPTION.match(neighbor.text):
                    # Verificar que el número de figura coincide
                    caption_num = re.search(r'\d+', neighbor.text)
                    if caption_num and int(caption_num.group()) == fig_num:
                        # Extraer caption (texto después de "Figura N.")
                        caption_text = neighbor.text.replace(
                            f"Figura {fig_num}", "").strip().lstrip(".").strip()
                        elem.image_info.caption = caption_text
                        # Marcar el párrafo del caption como consumido
                        neighbor.type = ElementType.EMPTY
                        neighbor.text = ""
                        break
```

---

## SECCIÓN 5: ENDPOINTS DEL BACKEND — AJUSTES NECESARIOS

### 5.1 Endpoint `/api/generate-preview-pdf` (nuevo, específico para preview)

**Separado de `/api/generate-pdf`** que es para exportación final. El preview endpoint debe:
- Ser más rápido (usar caché, no regenerar si no cambió)
- Retornar PDF + metadata (total_pages, engine_used)
- Soportar invalidación por hash del state

```python
@app.post("/api/generate-preview-pdf")
async def generate_preview_pdf(req: PreviewRequest) -> dict:
    """Genera PDF de preview usando motor dual COM/LO.
    
    Más rápido que /api/generate-pdf porque:
    1. Usa caché de PDF si el state no cambió
    2. No aplica post-procesamiento COM (trasplante portada)
    3. Solo genera DOCX + convierte a PDF
    """
    doc = load_session_state(req.session_id, STORAGE_DIR)
    if not doc:
        raise HTTPException(status_code=404)
    
    # Hash del state para invalidación de caché
    import hashlib
    state_hash = hashlib.sha256(
        json.dumps({
            "elements": [{"t": e.text, "type": e.type, "hl": e.heading_level}
                       for e in doc.elements],
            "rules": req.rules.model_dump_json() if req.rules else "",
            "portada": req.portada.model_dump_json() if req.portada else "",
        }, sort_keys=True).encode()
    ).hexdigest()[:12]
    
    cache_dir = STORAGE_DIR / "sessions" / req.session_id / "preview_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached_pdf = cache_dir / f"preview_{state_hash}.pdf"
    
    if cached_pdf.exists():
        return {
            "status": "ok",
            "download_url": f"/api/preview-pdf/{req.session_id}/{state_hash}",
            "total_pages": _count_pdf_pages(cached_pdf),
            "engine_used": "cache",
            "cache_hit": True,
        }
    
    # Generar DOCX APA7
    rules = req.rules or APARuleSet()
    out_dir = STORAGE_DIR / "sessions" / req.session_id
    preview_docx = out_dir / "preview_apa7.docx"
    
    generate_apa7_docx(doc, preview_docx, rules=rules,
                       portada=req.portada, references=req.references)
    
    # Convertir via DocConverter
    converter = get_doc_converter()
    success, pdf_path = converter.process_and_convert(
        None, preview_docx, preview_docx,  # No original para preview
        preserve_cover=False, generate_pdf=True
    )
    
    if success and pdf_path and pdf_path.exists():
        # Copiar a caché
        shutil.copy(pdf_path, cached_pdf)
        return {
            "status": "ok",
            "download_url": f"/api/preview-pdf/{req.session_id}/{state_hash}",
            "total_pages": _count_pdf_pages(cached_pdf),
            "engine_used": converter.get_active_engine(),
            "cache_hit": False,
        }
    
    return {"status": "fallback_css", "message": "PDF no disponible"}
```

### 5.2 Endpoint de servicio del PDF cacheado

```python
@app.get("/api/preview-pdf/{session_id}/{state_hash}")
async def serve_preview_pdf(session_id: str, state_hash: str):
    cache_dir = STORAGE_DIR / "sessions" / session_id / "preview_cache"
    pdf_file = cache_dir / f"preview_{state_hash}.pdf"
    if not pdf_file.exists():
        raise HTTPException(status_code=404, detail="PDF preview no encontrado.")
    return FileResponse(pdf_file, media_type="application/pdf")
```

---

## SECCIÓN 6: ARCHIVOS NUEVOS/MODIFICADOS — LISTA COMPLETA

### 6.1 Archivos NUEVOS (crear)

| Archivo | Descripción |
|---------|-------------|
| `python/generation/post_processor.py` | COMPostProcessor — trasplante portada + PDF via Word |
| `python/parsing/page_layout_provider.py` | PageLayoutProvider (3 backends: COM, LO, heuristic) |
| `python/parsing/style_fingerprint.py` | StyleFingerprint + clustering de headings |
| `python/services/__init__.py` | Imports para lo_service + doc_converter |
| `src/components/layout/PDFPreview.tsx` | (ya existe, REESCRIBIR con fixes) |
| `src/components/layout/ModeSwitch.tsx` | Toggle Editar/Resultado |
| `src/components/layout/ResultView.tsx` | Vista de resultado: PDFPreview + botones descarga |

### 6.2 Archivos MODIFICADOS (editar existentes)

| Archivo | Cambios |
|---------|---------|
| `python/services/lo_service.py` | Eliminar listener mode, usar solo CLI |
| `python/services/doc_converter.py` | Fix indentación, agregar fallback stub si post_processor no existe |
| `python/parsing/pre_classifier.py` | Integrar clustering + caption proximity |
| `python/parsing/docx_parser.py` | Agregar búsqueda wpg:wgp + anchor attrs + page_layout_provider |
| `python/generation/image_handler.py` | Preservar anchor attrs del original |
| `python/models.py` | Agregar campos a ImageModel (is_anchor, anchor_position_h/v, wrap_style) + PageLayoutResult |
| `python/main.py` | Import asyncio, crear /api/generate-preview-pdf, eliminar middleware duplicado, crear /api/preview-pdf/{hash} |
| `src/components/layout/LivePreview.tsx` | Eliminar toggle confuso, modo "Esquema" solo para outline |
| `src/components/layout/RibbonToolbar.tsx` | Redesignar: 4 acciones + ModeSwitch toggle |
| `src/components/wizard/Step6ExportWizard.tsx` | Agregar botón PDF + preview |
| `src/store/useDocStore.ts` | Agregar viewMode state, invalidación de pdfPreviewCache |
| `src/api/backend.ts` | Agregar generatePreviewPdf() con hash, fix tipado |
| `src/App.tsx` | Agregar ModeSwitch, layout dual (edit/result) |
| `src/types/index.ts` | Agregar viewMode, pdfPreviewCache, PageLayoutResult types |

### 6.3 Archivos ELIMINADOS

| Archivo | Razón |
|---------|-------|
| `src/components/layout/Sidebar.tsx` | Deprecated, no importado |
| `src/components/layout/HeaderBar.tsx` | Deprecated, no importado |

---

## SECCIÓN 7: ORDEN DE IMPLEMENTACIÓN

### Fase 1 (2-3 días): Backend foundation fixes
1. Crear `python/services/__init__.py`
2. Fix `lo_service.py` (eliminar listener)
3. Fix `doc_converter.py` (indentación)
4. Crear `python/generation/post_processor.py` (stub + COM si win32com disponible)
5. Import `asyncio` en `main.py`
6. Eliminar middleware duplicado

### Fase 2 (2-3 días): Preview + PDF endpoints
1. Crear `/api/generate-preview-pdf` endpoint
2. Crear `/api/preview-pdf/{session_id}/{hash}` endpoint
3. Rewrite `PDFPreview.tsx` (fix URL, fix useEffect deps, fix height)
4. Crear `generatePreviewPdf()` en `backend.ts`

### Fase 3 (2-3 días): UI redesign
1. Crear `ModeSwitch.tsx`
2. Crear `ResultView.tsx` (PDFPreview + botones descarga)
3. Redesign `RibbonToolbar.tsx` (4 acciones + mode toggle)
4. Modificar `App.tsx` para layout dual (edit/result)
5. Fix `Step6ExportWizard.tsx` (agregar PDF download)
6. Eliminar `Sidebar.tsx` y `HeaderBar.tsx` dead code

### Fase 4 (3-4 días): Heading clustering + page layout
1. Crear `python/parsing/style_fingerprint.py`
2. Integrar clustering en `pre_classifier.py`
3. Crear `python/parsing/page_layout_provider.py`
4. Conectar provider al pipeline (parser + pre_classifier + generator)

### Fase 5 (1-2 días): Image fixes
1. Agregar búsqueda recursiva wpg:wgp en `docx_parser.py`
2. Agregar anchor attrs a ImageModel + parser
3. Implementar caption proximity association
4. Preservar anchor attrs en `image_handler.py`

---

## SECCIÓN 8: CHECKLIST DE VERIFICACIÓN POST-IMPLEMENTACIÓN

Después de implementar TODO, verificar:

- [ ] `PDFPreview` refresca automáticamente cuando el usuario edita texto/rules/portada
- [ ] `PDFPreview` usa URL relativa (no hardcoded localhost)
- [ ] `doc_converter.py` indentación correcta (elif/else bien separados)
- [ ] `lo_service.py` no usa listener mode (solo CLI conversion)
- [ ] `post_processor.py` existe y no crashea el import
- [ ] `/api/generate-preview-pdf` retorna PDF + caché funciona
- [ ] `asyncio` importado en main.py
- [ ] Middleware `X-Request-ID` no duplicado
- [ ] Step6ExportWizard tiene botón DESCARGAR PDF
- [ ] UI tiene toggle Editar/Resultado claro
- [ ] RibbonToolbar tiene solo 4 acciones principales
- [ ] Sidebar.tsx y HeaderBar.tsx eliminados
- [ ] Clustering de headings funciona con corpus de 5 docs
- [ ] `page_layout_provider.py` cascade COM → LO → Heuristic funciona
- [ ] Imágenes dentro de wpg:wgp se detectan
- [ ] Anchor attrs se preservan en ImageModel
- [ ] Caption de figura se asocia por proximidad
- [ ] `python/services/__init__.py` existe

---

## SECCIÓN 9: NOTAS FINALES

1. **El v2 subido es INCOMPLETO** — solo contiene los archivos NEW/CHANGED, no el foundation completo. Para implementar, necesitas MERGE v2 changes sobre v1 codebase (el ZIP original que ya tienes).

2. **COM vs LibreOffice**: No elimines COM. COM es más preciso (paginación exacta de Word). LibreOffice es el fallback cross-platform. La cascade COM → LO → Heuristic es la estrategia correcta.

3. **UI redesign es lo más urgente para el usuario** — el preview "falla mucho" principalmente porque PDFPreview solo carga 1 vez y nunca se refresca. Fix B1 (useEffect deps) es el primer fix que debe aplicarse.

4. **Testing**: Usar los 5 documentos del corpus (`corpus/doc_01_limpio.docx` etc.) + los 2 documentos reales (`dspwalter.docx`, `10mo Trabajo Contabilidad.docx`) para verificar cada cambio.

5. **PyMuPDF dependency**: Para `page_layout_provider.py` LO path, agregar `PyMuPDF` a requirements.txt: `PyMuPDF>=1.24.0`
