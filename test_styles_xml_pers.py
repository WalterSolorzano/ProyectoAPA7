import docx
import zipfile
import io
import sys
sys.path.insert(0, 'python')
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()
styles_elem = doc.styles._element
print("styles_element tag:", styles_elem.tag)

# Modificar docDefaults
w_ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
docDefaults = styles_elem.find(f".//{{{w_ns}}}docDefaults")
if docDefaults is not None:
    pPr = docDefaults.find(f".//{{{w_ns}}}pPr")
    if pPr is not None:
        pPr.append(parse_xml(f'<w:spacing {nsdecls("w")} w:line="480" w:lineRule="auto"/>'))

buf = io.BytesIO()
doc.save(buf)
buf.seek(0)

with zipfile.ZipFile(buf, 'r') as z:
    styles_xml = z.read('word/styles.xml').decode('utf-8')
    print("¿w:line='480' está en styles.xml guardado?:", 'w:line="480"' in styles_xml)
