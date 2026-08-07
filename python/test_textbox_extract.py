from pathlib import Path

import docx

doc_path = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\10mo Trabajo Contabilidad_APA7.docx")
doc = docx.Document(str(doc_path))

def extract_textbox_texts_from_paragraph(p):
    texts = []
    # Buscar todos los w:txbxContent dentro del parrafo
    txbx_list = p._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}txbxContent')
    for txbx in txbx_list:
        p_nodes = txbx.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')
        full_t = " ".join("".join(node.itertext()).strip() for node in p_nodes if "".join(node.itertext()).strip())
        if full_t:
            texts.append(full_t)
    return texts

print("=== TEXTOS EXTRAIDOS DE TEXTBOXES EN P10 ===")
tx_p10 = extract_textbox_texts_from_paragraph(doc.paragraphs[10])
for idx, txt in enumerate(tx_p10):
    print(f"Textbox {idx}: {txt}")
