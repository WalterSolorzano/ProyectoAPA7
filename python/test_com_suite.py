"""
WordAPA7 - Suite Integral de Diagnóstico y Validación de COM
Verifica que las 5 áreas clave de Word COM funcionen al 100% sin bloqueos ni errores.
"""

import sys
import os
import asyncio
import time
from pathlib import Path

# Añadir directorio actual al path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

def test_1_word_com_service():
    print("\n[TEST 1] WordCOMService (Liveness & Multi-thread GIT access)...")
    from services.word_com_service import get_word_com_service
    service = get_word_com_service()
    assert service.is_available(), "Word no está instalado o no disponible en Windows"
    service.start()
    word = service.word
    assert word is not None, "service.word devolvió None"
    name = word.Name
    print(f"  -> Conexión exitosa a: {name} (PID: {service._pid})")
    return True

def test_2_page_layout_provider(docx_path: Path):
    print("\n[TEST 2] COMPageLayoutProvider (Paginación exacta)...")
    from parsing.page_layout_provider import COMPageLayoutProvider
    provider = COMPageLayoutProvider()
    assert provider.is_available(), "COMPageLayoutProvider no disponible"
    t0 = time.time()
    result = provider.paginate(docx_path, timeout_seconds=30)
    dt = time.time() - t0
    print(f"  -> Total páginas: {result.total_pages}, Párrafos: {len(result.paragraph_pages)}, Confianza: {result.confidence}, Tiempo: {dt:.2f}s")
    assert result.total_pages > 0, "Total de páginas no puede ser 0"
    assert len(result.paragraph_pages) > 0, "Lista de párrafos vacía"
    return True

def test_3_com_reader(docx_path: Path):
    print("\n[TEST 3] COMReader (Análisis estructural nativo)...")
    from parsing.com_reader import COMReader
    reader = COMReader()
    assert reader.is_available(), "COMReader no disponible"
    t0 = time.time()
    res = reader.analyze(docx_path)
    dt = time.time() - t0
    print(f"  -> Status: {res.get('ok')}, Headings: {len(res.get('headings', []))}, Secciones: {len(res.get('sections', []))}, Tiempo: {dt:.2f}s")
    assert res.get("ok") is True, f"Error en COMReader: {res.get('error')}"
    return True

async def test_4_spelling_validator(docx_path: Path):
    print("\n[TEST 4] SpellingValidator (Corrector ortográfico y gramatical nativo)...")
    from modules.spelling_validator import validate_spelling_and_grammar
    t0 = time.time()
    res = await validate_spelling_and_grammar(str(docx_path))
    dt = time.time() - t0
    print(f"  -> Status: {res.get('status')}, Errores ortográficos detectados: {len(res.get('spelling_errors', []))}, Errores gramaticales: {res.get('grammar_errors_count')}, Tiempo: {dt:.2f}s")
    assert res.get("status") == "ok", f"Error en spelling validator: {res}"
    return True

def test_5_post_processor(docx_path: Path):
    print("\n[TEST 5] COMPostProcessor (Estilos APA nativos + Layout enforcement + PDF)...")
    from generation.post_processor import COMPostProcessor
    processor = COMPostProcessor()
    assert processor.is_available(), "COMPostProcessor no disponible"
    
    out_docx = docx_path.parent / "test_out_com.docx"
    out_final = docx_path.parent / "test_final_com.docx"
    
    # Usar docx_path como source
    import shutil
    shutil.copy(docx_path, out_docx)
    
    t0 = time.time()
    ok, pdf_path = processor.process(
        original_path=docx_path,
        generated_path=out_docx,
        final_path=out_final,
        preserve_cover=False,
        generate_pdf=True
    )
    dt = time.time() - t0
    print(f"  -> Success: {ok}, PDF generado: {pdf_path}, Tiempo: {dt:.2f}s")
    
    # Limpieza
    if out_docx.exists():
        out_docx.unlink()
    if out_final.exists():
        out_final.unlink()
    if pdf_path and pdf_path.exists():
        pdf_path.unlink()
        
    assert ok is True, "COMPostProcessor falló"
    assert pdf_path is not None, "No se generó el PDF con COM"
    return True

async def main():
    test_file = Path("PCP_4M1.docx")
    if not test_file.exists():
        test_file = Path("../PCP_4M1.docx")
    if not test_file.exists():
        test_file = Path("dummy.docx")
    
    print(f"=== EJECUTANDO SUITE DE VALIDACIÓN COM EN: {test_file.resolve()} ===")
    
    t1 = test_1_word_com_service()
    t2 = test_2_page_layout_provider(test_file.resolve())
    t3 = test_3_com_reader(test_file.resolve())
    t4 = await test_4_spelling_validator(test_file.resolve())
    t5 = test_5_post_processor(test_file.resolve())
    
    print("\n" + "="*60)
    print("[OK] TODAS LAS PRUEBAS DE WORD COM (5/5) PASARON CON EXITO")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
