import zipfile
import re

def extract_meta(path):
    with zipfile.ZipFile(path) as z:
        try:
            app_xml = z.read('docProps/app.xml').decode('utf-8')
            total_time = re.search(r'<TotalTime>(\d+)</TotalTime>', app_xml)
            words = re.search(r'<Words>(\d+)</Words>', app_xml)
            pages = re.search(r'<Pages>(\d+)</Pages>', app_xml)
            print(f"TotalTime: {total_time.group(1) if total_time else 'N/A'}")
            print(f"Words: {words.group(1) if words else 'N/A'}")
        except Exception as e:
            print("Error app.xml:", e)
            
        try:
            core_xml = z.read('docProps/core.xml').decode('utf-8')
            revision = re.search(r'<cp:revision>(\d+)</cp:revision>', core_xml)
            print(f"Revision: {revision.group(1) if revision else 'N/A'}")
        except Exception as e:
            print("Error core.xml:", e)

extract_meta("dummy.docx")
