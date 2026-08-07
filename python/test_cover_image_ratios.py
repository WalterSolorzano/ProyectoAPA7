import sys
from pathlib import Path

from PIL import Image

sys.path.append(str(Path(__file__).parent))

from parsing.docx_parser import parse_docx_bytes

doc_path = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\10mo Trabajo Contabilidad.docx")
with open(doc_path, "rb") as f:
    file_bytes = f.read()

storage = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\storage")
doc_model = parse_docx_bytes(file_bytes, "10mo Trabajo Contabilidad.docx", "test_ratios_sess", storage)

print("=== IMÁGENES DE PORTADA Y SUS DIMENSIONES ===")
for idx, elem in enumerate(doc_model.elements):
    if elem.image_info:
        img_full_path = storage / "test_ratios_sess" / "images" / elem.image_info.filename
        if img_full_path.exists():
            with Image.open(img_full_path) as im:
                w, h = im.size
                ratio = h / w if w > 0 else 0
                is_line = ratio > 2.0
                print(f"Elem [{idx:02d}] {elem.image_info.filename}: Size = {w}x{h} | H/W Ratio = {ratio:.2f} | IsLine = {is_line}")
