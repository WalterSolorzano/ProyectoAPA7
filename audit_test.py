import sys
import json
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'python'))
from python.parsing.docx_parser import parse_docx_bytes
from pathlib import Path

def test_document(file_name):
    print(f"--- Probando documento: {file_name} ---")
    try:
        with open(file_name, "rb") as f:
            content = f.read()
        storage_dir = Path("test_storage")
        doc_model = parse_docx_bytes(content, file_name, "test_session_123", storage_dir)
        headings = [e for e in doc_model.elements if e.type == 'heading']
        print(f"Total de elementos: {len(doc_model.elements)}")
        print(f"Títulos detectados: {len(headings)}")
        for h in headings[:15]:
            print(f"  Nivel {h.heading_level}: {h.text[:50]}")
        print("Test exitoso.\n")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error procesando {file_name}: {e}\n")

if __name__ == "__main__":
    test_document("Estudio_Trabajo (1).docx")
    test_document("APA7_Colegio Anexo de Esquipulas 2.docx")
