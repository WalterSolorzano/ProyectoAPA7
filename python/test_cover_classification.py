"""
WordAPA7 — Test de Clasificación e Inspección de la Portada Real
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from parsing.docx_parser import parse_docx_bytes
from models import ElementType

doc_path = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\10mo Trabajo Contabilidad.docx")
with open(doc_path, "rb") as f:
    file_bytes = f.read()

doc_model = parse_docx_bytes(file_bytes, "10mo Trabajo Contabilidad_APA7.docx", "test_inspect_sess", Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\storage"))

print("=== ELEMENTOS CLASIFICADOS ===")
for idx, elem in enumerate(doc_model.elements[:25]):
    fig_num = elem.image_info.figure_number if elem.image_info else "-"
    print(f"[{idx:02d}] Type: {elem.type:<15} | FigNum: {fig_num} | Text: '{elem.text[:40]}'")
