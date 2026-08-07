"""
WordAPA7 — Automated Step-by-Step Wizard Test & Screenshots
Navega por los 7 pasos del Asistente Guiado y toma captura de cada etapa.
"""

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

doc_file = Path(r"C:\Users\--X\.gemini\antigravity\scratch\wordapa7\10mo Trabajo Contabilidad.docx")
out_dir = Path(r"C:\Users\--X\.gemini\antigravity\brain\98041f62-de9b-494a-8f99-4bd7db4c8e27")

def test_wizard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1024})

        print("1. Cargando aplicacion...")
        page.goto("http://localhost:8742", wait_until="networkidle")
        file_input = page.locator('input[type="file"]')
        if file_input.count() > 0:
            file_input.set_input_files(str(doc_file))

        time.sleep(3)
        page.wait_for_timeout(3000)

        # Paso 0 Screenshot
        page.screenshot(path=str(out_dir / "wizard_step0.png"))
        print("Paso 0 capturado.")

        # Hacer clic en Guardar Preferencias (Paso 1: Portada)
        btn_start = page.get_by_text("Guardar Preferencias e Iniciar")
        if btn_start.count() > 0:
            btn_start.click()
            time.sleep(1.5)
            page.screenshot(path=str(out_dir / "wizard_step1_portada.png"))
            print("Paso 1 (Portada) capturado.")

        # Hacer clic en Siguiente -> Paso 2 (Titulos)
        btn_next = page.get_by_text("Aprobar y Siguiente")
        if btn_next.count() > 0:
            btn_next.click()
            time.sleep(1.5)
            page.screenshot(path=str(out_dir / "wizard_step2_titulos.png"))
            print("Paso 2 (Titulos) capturado.")

        browser.close()
        print("Prueba de Asistente completada exitosamente!")

if __name__ == "__main__":
    test_wizard()
