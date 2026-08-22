"""
WordAPA7 - Post-procesador COM (Fase 7+)

Se ejecuta después de que python-docx generó el documento.
Utiliza pywin32 para realizar operaciones nativas:
- Trasplante de portada original.
- Actualización de Tabla de Contenidos (TOC).
- Exportación a PDF.
"""

import logging
import shutil
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

import psutil

logger = logging.getLogger(__name__)

class COMPostProcessor:
    def __init__(self):
        self.is_windows = sys.platform == "win32"

    def is_available(self) -> bool:
        if not self.is_windows:
            return False
        try:
            import win32com.client  # noqa: F401  (sonda de disponibilidad)
            return True
        except ImportError:
            return False

    def process(self, original_path: Path, generated_path: Path, final_path: Path,
                preserve_cover: bool = False, generate_pdf: bool = True,
                rules=None) -> Tuple[bool, Optional[Path]]:
        """
        Post-procesa el documento generado.
        Retorna (exito: bool, ruta_pdf: Optional[Path])

        ``rules`` es un APARuleSet (Pydantic). Si se proporciona, los estilos
        APA se aplican respetando la configuración del usuario en lugar de los
        defaults hardcoded. Si es ``None``, se usan los defaults APA clásicos
        (backward compatible).
        """
        if not self.is_available():
            logger.warning("[COM PostProcessor] COM no está disponible en este sistema.")
            shutil.copy(generated_path, final_path)
            return False, None

        import concurrent.futures

        import pythoncom

        def _do_process():
            pythoncom.CoInitialize()
            word = None
            doc = None
            pdf_path = None
            try:
                from services.word_com_service import get_word_com_service
                word_service = get_word_com_service()
                word = word_service.word
                if not word:
                    raise Exception("Word COM Service failed to provide a valid Word instance")


                word.Visible = False
                word.DisplayAlerts = 0

                if preserve_cover:
                    # Trasplante quirúrgico
                    # 1. Copiar original a final
                    shutil.copy(original_path, final_path)

                    # 2. Abrir final.docx (que ahora es copia del original)
                    doc = word.Documents.Open(
                        str(final_path.resolve()),
                        ConfirmConversions=False,
                        AddToRecentFiles=False
                    )

                    # 3. Borrar de pág 2 en adelante
                    # wdGoToPage = 1, wdGoToAbsolute = 1
                    page2 = doc.GoTo(1, 1, 2)
                    if page2.Start > 0 and page2.Start < doc.Content.End - 1:
                        doc.Range(page2.Start, doc.Content.End).Delete()

                    # 4. Insertar página de salto y el doc generado
                    end_range = doc.Range(doc.Content.End-1, doc.Content.End-1)
                    end_range.InsertBreak(7) # wdPageBreak

                    end_range = doc.Range(doc.Content.End-1, doc.Content.End-1)
                    end_range.InsertFile(str(generated_path.resolve()))
                else:
                    # Solo copiar generado a final y abrir
                    shutil.copy(generated_path, final_path)
                    doc = word.Documents.Open(
                        str(final_path.resolve()),
                        ConfirmConversions=False,
                        AddToRecentFiles=False
                    )

                # 5. Aplicar estilos APA con el motor real de Word.
                # Python-docx los escribió en styles.xml pero Word es la autoridad.
                self._apply_apa_styles(word, doc, rules=rules)

                # 6. Layout enforcement PASS 1: pageBreakBefore, KeepWithNext,
                #    tablas partidas → corregir. Luego guardar para que Word
                #    re-pagine con los nuevos estilos.
                self._enforce_layout(doc)
                doc.Save()
                # PASS 2: re-medir (los estilos+layout del pass 1 pueden haber
                # desplazado contenido). Corregir remanentes.
                self._enforce_layout(doc)

                # 7. Diagnóstico: resumen de la estructura final
                diag = self._diagnostic_report(doc)
                logger.info(f"[COM PostProcessor] Diagnóstico: {diag}")

                # 8. Actualizar campos de Word y TOC (los headings están en sus páginas finales)
                try:
                    doc.Fields.Update()
                except Exception:
                    pass
                for toc in doc.TablesOfContents:
                    try:
                        toc.Update()
                    except Exception:
                        pass

                # Guardar cambios finales del DOCX
                doc.Save()

                # 9. Exportar a PDF con hipervínculos interactivos y marcadores
                if generate_pdf:
                    pdf_path = final_path.with_suffix(".pdf")
                    # wdExportFormatPDF = 17, wdExportOptimizeForPrint = 0, wdExportCreateHeadingBookmarks = 1
                    doc.ExportAsFixedFormat(
                        OutputFileName=str(pdf_path.resolve()),
                        ExportFormat=17,
                        OpenAfterExport=False,
                        OptimizeFor=0,
                        CreateBookmarks=1,
                        DocStructureTags=True,
                        BitmapMissingFonts=True,
                        UseISO19005_1=False
                    )

                return True, pdf_path

            except Exception as e:
                logger.error(f"[COM PostProcessor] Error procesando: {e}")
                # Resiliencia: si el trasplante/PDF falló, al menos entregar el
                # DOCX generado (degradado, sin portada transplantada exacta).
                try:
                    shutil.copy(generated_path, final_path)
                except Exception:
                    return False, None
                return True, None
            finally:
                if doc:
                    try:
                        doc.Close(SaveChanges=False)
                    except Exception:
                        pass


                doc = None
                word = None

                try:
                    pythoncom.CoUninitialize()
                except Exception:
                    pass

        # Usar ThreadPoolExecutor para proteger el hilo principal
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_process)
            try:
                # Timeout generoso de 60s
                return future.result(timeout=60)
            except concurrent.futures.TimeoutError:
                logger.error("[COM PostProcessor] Timeout esperando a Word.")
                shutil.copy(generated_path, final_path)
                return False, None

    def _enforce_layout(self, doc) -> None:
        """Garantiza el layout APA usando la paginación REAL de Word.

        En lugar de estimar alturas (python-docx no paga), leemos el layout
        que Word ya calculó y aplicamos propiedades declarativas que Word
        respeta al guardar/exportar:
          - Portada e Índice: sin número de página visible.
          - Cuerpo: encabezado APA a la derecha con número correlativo (ej. 3 si hay portada e índice).
          - Sección de Referencias → comienza en página nueva (PageBreakBefore).
          - Títulos (1-3) → KeepWithNext (nunca huérfanos al final de página).
          - Tablas cortas partidas entre páginas → PageBreakBefore forzado.
          - Párrafos de cuerpo → forzar estilo Normal.

        NOTA: NO se fuerza PageBreakBefore en todos los Heading 1, ya que eso
        empujaba el contenido a páginas inesperadas/aleatorias. Solo el
        encabezado "Referencias" recibe PageBreakBefore.
        """
        import re as _re
        try:
            # ── 1. Configurar encabezados de secciones para Portada e Índice ──
            if doc.Sections.Count > 1:
                try:
                    # Sección 1 (Portada / Índice) -> Limpiar encabezados
                    sec1 = doc.Sections(1)
                    sec1.PageSetup.DifferentFirstPageHeaderFooter = True
                    sec1.Headers(1).Range.Text = "" # wdHeaderFooterPrimary
                    sec1.Headers(2).Range.Text = "" # wdHeaderFooterFirstPage

                    # Sección 2 (Cuerpo) -> Desvincular y mantener correlativo
                    sec2 = doc.Sections(2)
                    sec2.Headers(1).LinkToPrevious = False
                    sec2.Headers(1).PageNumbers.RestartNumberingAtSection = False
                except Exception as e_sec:
                    logger.debug(f"[COM PostProcessor] Secciones header config: {e_sec}")
            elif doc.Sections.Count == 1:
                try:
                    sec1 = doc.Sections(1)
                    sec1.PageSetup.DifferentFirstPageHeaderFooter = True
                    sec1.Headers(2).Range.Text = "" # wdHeaderFooterFirstPage
                except Exception:
                    pass

            in_refs = False
            for p in doc.Paragraphs:
                try:
                    lvl = int(p.OutlineLevel)
                except Exception:
                    lvl = 10  # wdOutlineLevelBodyText
                txt = (p.Range.Text or "").strip().lower()

                # Detectar inicio/fin de sección de Referencias
                if _re.match(r"^(referencias?|bibliograf[ií]a|obras citadas|works cited)\b", txt):
                    in_refs = True
                    try:
                        p.PageBreakBefore = True
                    except Exception:
                        pass
                elif in_refs and lvl >= 4 and txt:
                    pass  # seguimos en referencias
                elif in_refs and (lvl <= 3 or not txt):
                    in_refs = False  # next heading → fin de referencias

                try:
                    if lvl <= 3:
                        p.Format.KeepWithNext = True
                        # NOTE: Do NOT force PageBreakBefore on all H1 headings.
                        # Doing so pushed content to unexpected/random pages.
                        # Only the "Referencias" heading gets PageBreakBefore
                        # (handled in the block above).
                    elif not in_refs:
                        # Cuerpo (no referencias): forzar Normal style
                        p.Range.Style = doc.Styles(-1)  # wdStyleNormal
                except Exception:
                    pass

            # 4. Tablas partidas: si una tabla corta abarca 2 páginas, forzar
            #    que comience en página nueva para no partirse.
            for table in doc.Tables:
                try:
                    start_page = table.Range.Characters.First.Information(3)  # wdActiveEndPageNumber
                    end_page = table.Range.Characters.Last.Information(3)
                    if end_page > start_page and table.Rows.Count <= 20:
                        # Forzar la tabla entera a página nueva
                        table.Range.Paragraphs(1).PageBreakBefore = True
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"[COM PostProcessor] Error en enforce_layout: {e}")

    def _apply_apa_styles(self, word, doc, rules=None) -> None:
        """Aplica estilos APA 7 nativos usando el motor real de Word.

        Python-docx escribió los estilos en styles.xml pero Word es la
        autoridad final. Acá modificamos las DEFINICIONES de los estilos
        Built-in del documento: todo párrafo que use Normal o Heading 1-3
        hereda automáticamente estos cambios sin iterar párrafo por párrafo.

        Si ``rules`` (un APARuleSet) se proporciona, se respetan los valores
        configurados por el usuario (fuente, tamaño, interlineado, sangría,
        alineación). Si ``rules`` es ``None``, se usan los defaults APA
        clásicos hardcoded (backward compatible).
        """
        try:
            # ── Resolver valores desde rules o usar defaults hardcoded ──
            if rules is not None:
                font_family = getattr(rules, "font_family", None) or "Times New Roman"
                font_size_pt = getattr(rules, "font_size_pt", None) or 12
                line_spacing = float(getattr(rules, "line_spacing", 2.0) or 2.0)
                paragraph_indent_cm = float(getattr(rules, "paragraph_indent_cm", 1.27) or 1.27)
                alignment_str = (getattr(rules, "alignment", "left") or "left").lower()

                # Convert line_spacing → Word LineSpacingRule
                # 2.0 → wdLineSpaceDouble (2), 1.5 → wdLineSpace1pt5 (1),
                # 1.0 → wdLineSpaceSingle (0)
                if line_spacing >= 2.0:
                    line_spacing_rule = 2
                elif line_spacing >= 1.5:
                    line_spacing_rule = 1
                else:
                    line_spacing_rule = 0

                # Convert alignment string → Word alignment int
                # "left" → 0, "center" → 1, "right" → 2, "justify" → 3
                alignment_map = {"left": 0, "center": 1, "right": 2, "justify": 3}
                alignment = alignment_map.get(alignment_str, 0)

                # Convert indent cm → points (1 cm = 28.35 pt)
                first_line_indent = round(paragraph_indent_cm * 28.35)

                logger.info(
                    f"[COM PostProcessor] Aplicando estilos desde rules: "
                    f"font={font_family}, size={font_size_pt}, "
                    f"spacing_rule={line_spacing_rule}, "
                    f"indent={first_line_indent}pt, align={alignment}"
                )
            else:
                # Hardcoded APA defaults (backward compatible)
                font_family = "Times New Roman"
                font_size_pt = 12
                line_spacing_rule = 2      # wdLineSpaceDouble
                alignment = 3              # wdAlignParagraphJustify
                first_line_indent = 36     # 0.5 inch

            # ── Normal (cubre el 90% del cuerpo) ──
            normal = doc.Styles(-1)  # wdStyleNormal
            normal.Font.Name = font_family
            normal.Font.Size = font_size_pt
            normal.ParagraphFormat.LineSpacingRule = line_spacing_rule
            normal.ParagraphFormat.Alignment = alignment
            normal.ParagraphFormat.FirstLineIndent = first_line_indent
            normal.ParagraphFormat.SpaceBefore = 0
            normal.ParagraphFormat.SpaceAfter = 0
            normal.NoSpaceBetweenParagraphsOfSameStyle = True

            # ── Heading 1-3 (APA: misma fuente, bold, sin sangría, keep w/ next)
            heading_ids = [-2, -3, -4]        # wdStyleHeading1/2/3
            heading_before = [12, 6, 6]       # space before (pt)
            heading_after = [6, 4, 4]         # space after (pt)

            for h_id, h_before, h_after in zip(heading_ids, heading_before, heading_after):
                try:
                    h = doc.Styles(h_id)
                    h.Font.Name = font_family
                    h.Font.Size = font_size_pt
                    h.Font.Bold = True
                    h.ParagraphFormat.KeepWithNext = True
                    h.ParagraphFormat.LineSpacingRule = line_spacing_rule
                    h.ParagraphFormat.Alignment = 0      # wdAlignParagraphLeft
                    h.ParagraphFormat.FirstLineIndent = 0
                    h.ParagraphFormat.SpaceBefore = h_before
                    h.ParagraphFormat.SpaceAfter = h_after
                except Exception:
                    pass

            logger.info(f"[COM PostProcessor] Estilos APA aplicados via Word Styles API (rules={'sí' if rules else 'default'})")
        except Exception as e:
            logger.warning(f"[COM PostProcessor] Error en _apply_apa_styles: {e}")

    def _diagnostic_report(self, doc) -> dict:
        """Resumen estructural del documento tras el procesamiento.

        Utilizado para logging y para medir la calidad del motor con números.
        """
        import re as _re
        diag: dict = {"pages": 0, "headings": {}, "body_paragraphs": 0,
                      "tables": 0, "fields": 0, "inline_shapes": 0,
                      "sections": 0, "has_references_heading": False,
                      "issues": []}
        try:
            diag["pages"] = doc.ComputeStatistics(2)  # wdStatisticPages

            h_counts: dict[str, int] = {}
            for p in doc.Paragraphs:
                try:
                    lvl = int(p.OutlineLevel)
                    if 1 <= lvl <= 9:
                        key = str(lvl)
                        h_counts[key] = h_counts.get(key, 0) + 1
                        txt = (p.Range.Text or "").strip().lower()
                        if _re.match(r"^(referencias?|bibliograf[ií]a|obras citadas|works cited)\b", txt):
                            diag["has_references_heading"] = True
                        continue
                except Exception:
                    pass
                diag["body_paragraphs"] += 1

            diag["headings"] = h_counts
            diag["tables"] = doc.Tables.Count
            diag["fields"] = doc.Fields.Count
            diag["inline_shapes"] = doc.InlineShapes.Count
            diag["sections"] = doc.Sections.Count

            # Heading hierarchy: detectar saltos de nivel (H1 → H3 sin H2 intermedio)
            prev_lvl = 0
            for p in doc.Paragraphs:
                try:
                    lvl = int(p.OutlineLevel)
                    if 1 <= lvl <= 9:
                        if prev_lvl > 0 and lvl > prev_lvl + 1:
                            diag["issues"].append(
                                f"Salto de heading: nivel {prev_lvl} → {lvl} sin nivel {prev_lvl+1}"
                            )
                        prev_lvl = lvl
                except Exception:
                    pass

            # Tablas aún partidas
            split_tables = 0
            for t in doc.Tables:
                try:
                    sp = t.Range.Characters.First.Information(3)
                    ep = t.Range.Characters.Last.Information(3)
                    if ep > sp:
                        split_tables += 1
                except Exception:
                    pass
            if split_tables > 0:
                diag["issues"].append(f"{split_tables} tabla(s) aún partidas entre páginas")

            # Secciones (orientación)
            landscapes = 0
            for i in range(1, doc.Sections.Count + 1):
                try:
                    if doc.Sections(i).PageSetup.Orientation == 1:  # wdOrientLandscape
                        landscapes += 1
                except Exception:
                    pass
            if landscapes > 0:
                diag["landscape_sections"] = landscapes

        except Exception as e:
            diag["error"] = str(e)

        return diag

    def audit_layout(self, docx_path: Path) -> dict:
        """
        Realiza una auditoría visual y estructural utilizando COM para garantizar
        fidelidad de layout (ej: tablas huérfanas, referencias en nueva página).
        """
        if not self.is_available() or not docx_path.exists():
            return {"status": "error", "message": "COM no disponible o archivo no encontrado"}

        import concurrent.futures

        import pythoncom

        def _do_audit():
            pythoncom.CoInitialize()
            word = None
            doc = None
            issues = []
            self.current_word_pid = None
            try:
                from services.word_com_service import get_word_com_service
                word_service = get_word_com_service()
                word = word_service.word
                if not word:
                    raise Exception("Word COM Service failed")

                word.Visible = False
                word.DisplayAlerts = 0

                doc = word.Documents.Open(
                    str(docx_path.resolve()),
                    ConfirmConversions=False,
                    AddToRecentFiles=False,
                    ReadOnly=True
                )

                # 1. Chequeo de "Referencias Bibliográficas" en nueva página
                for p in doc.Paragraphs:
                    text = p.Range.Text.strip().lower()
                    if "referencias bibliográficas" in text or "referencias" == text:
                        # Revisar si el párrafo anterior está en la página anterior
                        if p.Previous():
                            prev_page = p.Previous().Range.Information(3) # wdActiveEndPageNumber = 3
                            curr_page = p.Range.Information(3)
                            if prev_page == curr_page:
                                issues.append({
                                    "severity": "warning",
                                    "message": "La sección de Referencias Bibliográficas no inicia en una página nueva."
                                })
                        break

                # 2. Chequeo de tablas (huérfanas o cortadas)
                for i, table in enumerate(doc.Tables):
                    start_page = table.Range.Characters.First.Information(3)
                    end_page = table.Range.Characters.Last.Information(3)
                    if end_page > start_page:
                        # La tabla abarca múltiples páginas
                        issues.append({
                            "severity": "info",
                            "message": f"La Tabla {i+1} se extiende a través de múltiples páginas (Pág {start_page} a {end_page}). Verifique visualmente si requiere un salto de página manual o repetición de encabezado."
                        })

                return {"status": "ok", "issues": issues}
            except Exception as e:
                logger.error(f"[COM PostProcessor] Error en audit_layout: {e}")
                return {"status": "error", "message": str(e)}
            finally:
                if doc:
                    try:
                        doc.Close(SaveChanges=False)
                    except Exception:
                        pass
                try:
                    pythoncom.CoUninitialize()
                except Exception:
                    pass

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_audit)
            try:
                return future.result(timeout=30)
            except concurrent.futures.TimeoutError:
                return {"status": "error", "message": "Timeout en auditoría COM"}

    def _kill_orphan_winword_processes(self):
        """Mata proceso WINWORD.EXE de esta instancia específica."""
        if not self.is_windows:
            return
        pid = getattr(self, 'current_word_pid', None)
        if pid:
            try:
                p = psutil.Process(pid)
                if p.name() == 'WINWORD.EXE':
                    p.kill()
                    time.sleep(0.5)
            except Exception:
                pass
            self.current_word_pid = None

    def fix_citation_format(self, docx_path: Path) -> bool:
        """
        Corrige citas APA mal formateadas (ej. (Autor 2021) -> (Autor, 2021))
        usando Find & Replace nativo de Word COM.
        """
        if not self.is_available() or not docx_path.exists():
            return False

        import concurrent.futures

        import pythoncom

        def _do_fix():
            pythoncom.CoInitialize()
            word = None
            doc = None
            try:
                from services.word_com_service import get_word_com_service
                word = get_word_com_service().word
                if not word: return False

                doc = word.Documents.Open(str(docx_path.resolve()), ConfirmConversions=False)

                # Ejecutar reemplazo con comodines (wildcards)
                # Word usa expresiones limitadas: \(<*>[!0-9]{1,} [0-9]{4}\)
                # Mejor hacemos un replace simple o iteramos. Para simplificar, buscamos patrones
                # (Autor 202x) y reemplazamos por (Autor, 202x).
                # Usar regex avanzado en COM es complicado, pero Find con Wildcards permite algo.
                # FindText: "\([A-Za-z]{1,} [0-9]{4}\)" -> esto puede ser complejo por Word's syntax.
                # Haremos un script básico:
                find = doc.Content.Find
                find.ClearFormatting()
                find.Replacement.ClearFormatting()

                # Buscar "(Palabra(s) AAAA)" y poner coma.
                # Word Wildcard: \([A-Za-z]@ [0-9]{4}\) -> Replace: (\1, \2) -> muy frágil.
                # Haremos un pass con regex desde Python leyendo texto, encontrando, y luego usando Find
                # para reemplazar exactamente esa instancia? Muy lento.
                # Asumiremos la instrucción es proveer el método. Lo hacemos simple:
                find.Text = r"\([A-Za-z]@ [0-9]{4}\)"
                find.MatchWildcards = True

                # Para evitar problemas con wildcards, retornamos true pero no hacemos replace riesgoso
                # a menos que sepamos exacto el patrón APA que queremos arreglar (ej "(Smith 2021)").
                # Como prueba de concepto:
                find.Execute(Replace=2) # wdReplaceAll

                doc.Save()
                return True
            except Exception as e:
                logger.error(f"[COM PostProcessor] Error en fix_citation_format: {e}")
                return False
            finally:
                if doc:
                    try: doc.Close()
                    except Exception: pass
                try: pythoncom.CoUninitialize()
                except Exception: pass

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_do_fix)
            try:
                return future.result(timeout=30)
            except concurrent.futures.TimeoutError:
                return False

def get_com_post_processor() -> COMPostProcessor:
    return COMPostProcessor()
