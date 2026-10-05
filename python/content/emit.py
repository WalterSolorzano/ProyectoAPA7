from __future__ import annotations

from pathlib import Path

from models import DocumentModel, PortadaData

from generation.generator import generate_apa7_docx


def _portada(doc: DocumentModel) -> PortadaData:
    data = doc.portada or {}
    valid = {k: v for k, v in data.items() if k in PortadaData.model_fields}
    return PortadaData(**valid)


def emit_docx(doc: DocumentModel, out_path: Path, try_com: bool = True) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    generate_apa7_docx(doc, out_path, doc.apa_rules, _portada(doc), doc.referencias)

    if not try_com:
        return out_path
    try:
        from services.doc_converter import get_doc_converter

        converter = get_doc_converter()
        if converter.get_active_engine() != "COM":
            return out_path
        ok, final = converter.process_and_convert(
            original_path=out_path,
            generated_path=out_path,
            final_path=out_path,
            preserve_cover=False,
            generate_pdf=False,
            rules=doc.apa_rules,
        )
        if ok and final:
            return Path(final)
    except RuntimeError:
        return out_path
    except Exception:
        return out_path
    return out_path
