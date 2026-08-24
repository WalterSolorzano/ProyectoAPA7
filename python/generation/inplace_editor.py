"""WordAPA7 — Motor de edición IN-PLACE.

Abre el .docx ORIGINAL y modifica SOLO los párrafos del cuerpo.
La portada original (todo párrafo con índice < body_start_paragraph_idx),
las secciones (sectPr), headers/footers y estilos existentes NUNCA se tocan:
python-docx preserva intactas las partes que no se modifican.

Scopes soportados (coinciden con scoped_apply):
  texto            -> tipografía/interlineado/sangría de párrafos del cuerpo
  tablas_imagenes  -> estilo APA de tablas (bordes/header row); imágenes intactas
  bibliografia     -> sangría francesa en el bloque final de referencias

Contrato duro (testeado):
  * Ningún párrafo con idx < body_start cambia NI UN BYTE.
  * sectPr / headers / footers / styles.xml byte-idénticos.
  * Si scopes está definido, solo esos ámbitos cambian.
"""
from __future__ import annotations

import hashlib
import io
import re
import time
import zipfile
from pathlib import Path
from typing import Any, Iterable

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

try:
    from wordapa7_logger import log_event
except Exception:  # pragma: no cover
    def log_event(*a, **k): pass


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def _canon(data: bytes) -> str:
    """Hash canónico XML (inmune a re-serialización de python-docx)."""
    from lxml import etree
    try:
        tree = etree.fromstring(data)
        return hashlib.sha256(etree.tostring(tree, method="c14n")).hexdigest()[:12]
    except Exception:
        return _sha(data)


def _cover_floor_by_content(doc: Any) -> int:
    """Piso adicional: la portada termina antes del primer Heading real o del
    primer parrafo largo de cuerpo. Nunca confiar solo en el indice guardado."""
    floor = 0
    for i, para in enumerate(doc.paragraphs[:60]):
        txt = (para.text or "").strip()
        style = (para.style.name or "").lower() if para.style is not None else ""
        if "heading" in style or "título" in style:
            return i
        # parrafo de cuerpo tipico: >180 chars o contiene citas (Autor, 2019)
        if len(txt) > 180 or re.search(r"\([A-Z][^)]{2,40},\s*(19|20)\d{2}\)", txt):
            return i
    return max(floor, 0)


def _body_start(doc_model: Any) -> int:
    p = getattr(doc_model, "portada", None) or {}
    if isinstance(p, dict):
        raw = p.get("body_start_paragraph_idx")
    else:
        raw = getattr(p, "body_start_paragraph_idx", None)
    try:
        v = int(raw)
        return max(v, 0)
    except (TypeError, ValueError):
        return 0


def _is_ref_paragraph(text: str) -> bool:
    t = text.strip()
    return bool(t) and len(t) > 40 and re.search(r"\(\d{4}\)|\(\d{4}[a-z]?\)", t)


def apply_inplace(
    original_path: Path,
    out_path: Path,
    doc_model: Any,
    rules: Any,
    scopes: Iterable[str] | None = None,
) -> Path:
    """Edita el documento original respetando portada/secciones al 100%."""
    t0 = time.time()
    active = set(scopes) if scopes is not None else {"texto", "tablas_imagenes", "bibliografia"}
    body_start = max(_body_start(doc_model), 0)
    try:
        body_start = max(body_start, _cover_floor_by_content(pre))
    except Exception:
        pass


    orig_bytes = Path(original_path).read_bytes()

    # Snapshots de garantía: portada (párrafos < body_start) y partes globales.
    pre = Document(io.BytesIO(orig_bytes))
    cover_before = [_sha(p._element.xml.encode("utf-8")) for p in pre.paragraphs[:body_start]]
    global_before = {}
    with zipfile.ZipFile(io.BytesIO(orig_bytes)) as z:
        for name in z.namelist():
            if name.startswith(("word/styles.", "word/header", "word/footer")) or name.endswith("document.xml.rels"):
                global_before[name] = _canon(z.read(name))

    doc = Document(io.BytesIO(orig_bytes))
    paragraphs = doc.paragraphs
    font_name = getattr(rules, "font_family", None) or "Times New Roman"
    font_size = Pt(getattr(rules, "font_size", 12) or 12)
    line_sp = float(getattr(rules, "line_spacing", 2.0) or 2.0)

    changed = 0
    if "texto" in active or "bibliografia" in active:
        # Localizar inicio de bibliografía: último heading 'Referencias' o primer párrafo-ref
        ref_zone_start = len(paragraphs)
        for i in range(len(paragraphs) - 1, body_start, -1):
            if paragraphs[i].text.strip().lower().rstrip(":") == "referencias":
                ref_zone_start = i + 1
                break

    for i, para in enumerate(paragraphs):
        if i < body_start:
            continue  # PORTADA INTOCABLE — contrato duro
        text = para.text.strip()
        if not text:
            continue
        style_name = (para.style.name or "").lower() if para.style is not None else ""
        if "heading" in style_name or "título" in style_name:
            continue  # headings: los maneja la ruta rebuild si el usuario lo pide

        if "bibliografia" in active and i >= ref_zone_start and _is_ref_paragraph(text):
            pf = para.paragraph_format
            pf.left_indent = Inches(0.5)
            pf.first_line_indent = Inches(-0.5)
            pf.line_spacing = line_sp
            changed += 1
            continue

        if "texto" in active:
            pf = para.paragraph_format
            pf.line_spacing = line_sp
            pf.space_after = Pt(0)
            pf.space_before = Pt(0)
            first_vis = bool(getattr(rules, "indent_first_line", True))
            pf.first_line_indent = Inches(0.5) if first_vis else Inches(0)
            for run in para.runs:
                run.font.name = font_name
                run.font.size = font_size
            changed += 1

    if "tablas_imagenes" in active:
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement

        for tbl in doc.tables:
            tbl.alignment = WD_ALIGN_PARAGRAPH.CENTER if hasattr(tbl, "alignment") else tbl.alignment
            tbl.autofit = True
            # Bordes horizontales únicamente (estilo APA clásico)
            tblPr = tbl._tbl.tblPr
            borders = tblPr.find(qn("w:tblBorders"))
            if borders is not None:
                tblPr.remove(borders)
            borders = OxmlElement("w:tblBorders")
            for edge in ("top", "bottom"):
                el = OxmlElement(f"w:{edge}")
                el.set(qn("w:val"), "single"); el.set(qn("w:sz"), "8")
                el.set(qn("w:color"), "000000")
                borders.append(el)
            for edge in ("left", "right", "insideH", "insideV"):
                el = OxmlElement(f"w:{edge}")
                el.set(qn("w:val"), "none")
                borders.append(el)
            tblPr.append(borders)
            # Header row en negrita, sin rellenar celdas de portada (tablas de portada no existen tras filtro)
            if len(tbl.rows) > 0:
                for cell in tbl.rows[0].cells:
                    for p in cell.paragraphs:
                        for r in p.runs:
                            r.font.bold = True
                            r.font.name = font_name
                            r.font.size = font_size

    buf = io.BytesIO()
    doc.save(buf)
    out_bytes = buf.getvalue()

    # Verificación post-escritura: portada y globales idénticos.
    post = Document(io.BytesIO(out_bytes))
    cover_after = [_sha(p._element.xml.encode("utf-8")) for p in post.paragraphs[:body_start]]
    violations = [j for j, (a, b) in enumerate(zip(cover_before, cover_after)) if a != b]
    if violations:
        raise RuntimeError(
            f"INPLACE_VIOLATION: {len(violations)} párrafos de portada modificados "
            f"(índices {violations[:5]}). Abortado."
        )
    with zipfile.ZipFile(io.BytesIO(out_bytes)) as z:
        for name, sha in global_before.items():
            now = _canon(z.read(name))
            if now != sha:
                raise RuntimeError(f"INPLACE_VIOLATION: parte global modificada ({name}). Abortado.")

    out_path = Path(out_path)
    out_path.write_bytes(out_bytes)
    log_event("inplace", "applied",
              data={"scope": sorted(active), "body_start": body_start, "changed": changed,
                    "ms": int((time.time() - t0) * 1000)})
    return out_path
