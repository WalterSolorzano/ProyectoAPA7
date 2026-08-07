import re
from pathlib import Path

import docx

doc_path = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\10mo Trabajo Contabilidad_APA7.docx")
doc = docx.Document(str(doc_path))

p10 = doc.paragraphs[10]
xml_bytes = p10._element.xml

texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml_bytes)
print("=== TODOS LOS W:T EN P10 ===")
print(texts)

v_texts = re.findall(r'<v:textbox[^>]*>(.*?)</v:textbox>', xml_bytes, re.DOTALL)
print(f"v:textbox encontradas: {len(v_texts)}")
for idx, vt in enumerate(v_texts):
    sub_texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', vt)
    print(f"   Textbox {idx}:", " ".join(sub_texts))
