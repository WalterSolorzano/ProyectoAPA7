/**
 * WordAPA7 Add-in — Motor Maestro de Normalización In-Document
 * =============================================================
 *
 * Normalización completa e inteligente de documentos académicos en Word.
 *
 * Correcciones críticas:
 *   1. PROTECCIÓN DE ÍNDICE / TOC: Detecta líneas de contenido/índice (con puntos/números)
 *      y las mantiene intactas SIN sangría de primera línea.
 *   2. ELIMINACIÓN DE SANGRÍA SOBRE SANGRÍA: Resetea leftIndent=0 y rightIndent=0
 *      antes de aplicar firstLineIndent=36pt (0.5 pulgadas exactas).
 *   3. JERARQUÍA INTELIGENTE DE TÍTULOS:
 *      - Números Romanos (I., II., III.) o Secciones Principales -> Nivel 1 (Centrado, Negrita).
 *      - Números Decimales (1.1., 1.2., 2.1., 3.1.) -> Nivel 2 (Izquierda, Negrita).
 *      - Subtítulos (Situación problemática, Preguntas propuestas, etc.) -> Nivel 3 (Izquierda, Negrita + Cursiva).
 *   4. PORTADA CENTRADA: Centrada, doble espacio, SIN sangría.
 *   5. TABLAS APA 7 SEGURAS: Formateo de celdas y rótulos sin InvalidArgument.
 *   6. REFERENCIAS CON SANGRÍA FRANCESA: leftIndent=36pt, firstLineIndent=-36pt.
 */

const FONT_NAME = 'Times New Roman'
const FONT_SIZE = 12
const LINE_SPACING_DOUBLE = 24
const FIRST_LINE_INDENT_PT = 36 // 0.5 pulgadas = 1.27 cm

export interface NormalizationReport {
  coverDetected: boolean
  tocProtected: boolean
  headingsCount: number
  paragraphsCount: number
  tablesCount: number
  figuresCount: number
  referencesCount: number
}

/** Títulos canónicos de Nivel 1 */
const H1_CANONICAL = /^(?:resumen|abstract|introducci[oó]n|m[eé]todo|metodolog[ií]a|resultados|discusi[oó]n|conclusi[oó]n|conclusiones|recomendaciones|referencias|bibliograf[ií]a|marco\s+te[oó]rico|planteamiento\s+del\s+problema|justificaci[oó]n|objetivos|estado\s+del\s+arte)$/i

/** Detección de números romanos al inicio: I., II., III., IV., V., etc. */
const H1_ROMAN_REGEX = /^(?:cap[ií]tulo\s+[ivxlcdm\d]+|[ivxlcdm]+\.[\s	]+[a-zÁÉÍÓÚÑ])/i

/** Detección de títulos Nivel 2: 1.1., 1.2., 2.1., 3.1., etc. */
const H2_DECIMAL_REGEX = /^\d+\.\d+\.?[\s	]+[a-zÁÉÍÓÚÑ]/i

/** Detección de títulos Nivel 3: 1.1.1. o términos frecuentes de subtítulo */
const H3_SUB_REGEX = /^(?:\d+\.\d+\.\d+\.?[\s	]+|situaci[oó]n\s+problem[aá]tica|preguntas?\s+propuestas?|objetivos?\s+espec[ií]ficos?|dise[nñ]o\s+metodol[oó]gico|poblaci[oó]n\s+y\s+muestra|instrumentos?\s+de\s+recolecci[oó]n|an[aá]lisis\s+de\s+resultados|ventajas|limitaciones|trabajos\s+futuros)/i

/** Patrón de líneas de Índice / Tabla de Contenidos (terminan con puntos o tabs y número de página) */
const TOC_LINE_REGEX = /(?:\.{2,}|_{2,}|	|\s{4,})\s*\d+\s*$/

/** Título de la sección de índice */
const TOC_HEADER_REGEX = /^(?:tabla\s+de\s+contenido|contenido|[ií]ndice(?:\s+general|\s+de\s+tablas|\s+de\s+figuras)?)$/i

/** Patrones de metadatos de portada */
const COVER_METADATA_REGEX = /(?:autor(?:a)?|estudiante|carrera|facultad|universidad|instituto|profesor(?:a)?|docente|materia|curso|c[aá]tedra|fecha|a[nñ]o\s+acad[eé]mico|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i

export async function normalizeEntireDocumentAPA7(
  onProgress?: (step: string, percent: number) => void
): Promise<NormalizationReport> {
  return await Word.run(async (context) => {
    onProgress?.('Mapeando estructura del documento...', 10)

    const paragraphs = context.document.body.paragraphs
    context.load(paragraphs, 'text,font,firstLineIndent,leftIndent,rightIndent,lineSpacing,alignment')
    const tables = context.document.body.tables
    context.load(tables)
    const pictures = context.document.body.inlinePictures
    context.load(pictures)
    await context.sync()

    onProgress?.('Analizando portada e índice...', 25)

    // 1. DETECTAR PORTADA E ÍNDICE
    let coverEndIndex = -1
    let inTOC = false
    let tocProtected = false
    let hasCover = false

    const initialLimit = Math.min(12, paragraphs.items.length)
    let coverMatches = 0

    for (let i = 0; i < initialLimit; i++) {
      const t = paragraphs.items[i].text.trim()
      if (!t) continue

      if (TOC_HEADER_REGEX.test(t) || H1_CANONICAL.test(t) || H1_ROMAN_REGEX.test(t)) {
        break
      }
      if (COVER_METADATA_REGEX.test(t)) {
        coverMatches++
        coverEndIndex = i
      }
    }

    if (coverMatches >= 2 || (coverEndIndex > 0 && coverEndIndex <= 8)) {
      hasCover = true
    }

    // Formatear Portada (centrada, sin sangría)
    if (hasCover && coverEndIndex >= 0) {
      for (let i = 0; i <= coverEndIndex; i++) {
        const p = paragraphs.items[i]
        const t = p.text.trim()
        if (!t) continue

        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 0
        p.spaceAfter = 0
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        p.alignment = Word.Alignment.centered

        if (i === 0 || (i === 1 && !paragraphs.items[0].text.trim())) {
          p.font.bold = true
        } else {
          p.font.bold = false
        }
      }
    }

    onProgress?.('Jerarquizando títulos y protegiendo índice...', 50)

    // 2. RECORRER CUERPO, ÍNDICE, TÍTULOS Y REFERENCIAS
    let headingsCount = 0
    let paragraphsCount = 0
    let referencesCount = 0
    let inReferencesSection = false

    const startIdx = hasCover ? coverEndIndex + 1 : 0

    for (let i = startIdx; i < paragraphs.items.length; i++) {
      const p = paragraphs.items[i]
      const rawText = p.text
      const text = rawText.trim()
      if (!text) continue

      // A) Detección de Sección de Índice / Tabla de Contenidos
      if (TOC_HEADER_REGEX.test(text)) {
        inTOC = true
        tocProtected = true
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.alignment = Word.Alignment.centered
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // Si estamos en el índice y encontramos una línea de TOC (con números de página o puntos)
      if (inTOC) {
        // Si encontramos un título principal formal que no es de índice, salimos del TOC
        if ((H1_CANONICAL.test(text) || H1_ROMAN_REGEX.test(text)) && !TOC_LINE_REGEX.test(text) && text.length < 60) {
          inTOC = false
        } else {
          // Línea dentro del índice: NUNCA aplicar sangría de primera línea para no romper los números
          p.font.name = FONT_NAME
          p.font.size = FONT_SIZE
          p.leftIndent = 0
          p.rightIndent = 0
          p.firstLineIndent = 0
          p.alignment = Word.Alignment.left
          continue
        }
      }

      // Si una línea aislada parece una entrada de índice con puntos guía
      if (TOC_LINE_REGEX.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        continue
      }

      // B) Detección de Sección de Referencias / Bibliografía
      if (/^(?:referencias|bibliograf[ií]a|references)$/i.test(text)) {
        inReferencesSection = true
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.centered
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 12
        p.spaceAfter = 6
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // Entradas de Referencias (Sangría francesa reglamentaria)
      if (inReferencesSection) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = false
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 0
        p.spaceAfter = 0
        p.leftIndent = FIRST_LINE_INDENT_PT
        p.firstLineIndent = -FIRST_LINE_INDENT_PT
        p.rightIndent = 0
        referencesCount++
        continue
      }

      // C) Rótulos de Tablas y Figuras
      if (/^Tabla\s+\d+/i.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        p.spaceBefore = 12
        p.spaceAfter = 0
        continue
      }
      if (/^Figura\s+\d+/i.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        p.spaceBefore = 12
        p.spaceAfter = 0
        continue
      }
      if (/^Nota\./i.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = 10
        p.font.bold = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        p.spaceBefore = 4
        p.spaceAfter = 12
        continue
      }

      // D) Título Nivel 1 (H1) — Centrado, Negrita
      const isH1 = (H1_CANONICAL.test(text) || H1_ROMAN_REGEX.test(text)) && text.length < 80 && !text.endsWith('.')
      if (isH1) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.centered
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 12
        p.spaceAfter = 6
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // E) Título Nivel 2 (H2) — Izquierda, Negrita (ej. 1.1., 1.2., Caso No. 1...)
      const isH2 = H2_DECIMAL_REGEX.test(text) && text.length < 100 && !text.endsWith('.')
      if (isH2) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 12
        p.spaceAfter = 4
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // F) Título Nivel 3 (H3) — Izquierda, Negrita + Cursiva (ej. Situación problemática)
      const isH3 = (H3_SUB_REGEX.test(text) || (text.length < 50 && !text.endsWith('.') && !text.includes(','))) && text.length > 3
      if (isH3) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = true
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 10
        p.spaceAfter = 4
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // G) Párrafo Normal de Cuerpo — Sangría de 0.5" EXACTA (Sin Sangría sobre Sangría)
      p.font.name = FONT_NAME
      p.font.size = FONT_SIZE
      p.font.bold = false
      p.font.italic = false
      p.alignment = Word.Alignment.left
      p.lineSpacing = LINE_SPACING_DOUBLE
      p.spaceBefore = 0
      p.spaceAfter = 0
      // Reseteo estricto de márgenes para evitar duplicación de sangría
      p.leftIndent = 0
      p.rightIndent = 0
      p.firstLineIndent = FIRST_LINE_INDENT_PT
      paragraphsCount++
    }

    onProgress?.('Formateando tablas reglamentarias...', 75)

    // 3. FORMATEAR TABLAS EN VIVO (Sin InvalidArgument)
    let currentTableNum = 1
    for (const table of tables.items) {
      const rows = table.rows
      context.load(rows)
    }
    await context.sync()

    for (const table of tables.items) {
      for (const row of table.rows.items) {
        const cells = row.cells
        context.load(cells)
      }
    }
    await context.sync()

    for (const table of tables.items) {
      for (let ri = 0; ri < table.rows.items.length; ri++) {
        const isHeader = ri === 0
        const row = table.rows.items[ri]
        for (const cell of row.cells.items) {
          const cp = cell.body.paragraphs.getFirst()
          cp.font.name = FONT_NAME
          cp.font.size = FONT_SIZE
          cp.lineSpacing = 18
          cp.spaceBefore = 2
          cp.spaceAfter = 2
          cp.leftIndent = 0
          cp.rightIndent = 0
          cp.firstLineIndent = 0
          if (isHeader) {
            cp.font.bold = true
            cp.alignment = Word.Alignment.left
          }
        }
      }

      // Inyectar rótulo "Tabla N" arriba de forma segura
      try {
        const tableRange = table.getRange()
        const firstPara = tableRange.paragraphs.getFirstOrNullObject()
        const prevPara = firstPara.getPreviousOrNullObject()
        context.load(prevPara, 'text')
        await context.sync()

        const hasCaption = !prevPara.isNullObject && /^Tabla\s+\d+/i.test(prevPara.text.trim())
        if (!hasCaption) {
          const pNum = table.insertParagraph(`Tabla ${currentTableNum}`, Word.InsertLocation.before)
          pNum.font.name = FONT_NAME
          pNum.font.size = FONT_SIZE
          pNum.font.bold = true
          pNum.alignment = Word.Alignment.left
          pNum.lineSpacing = LINE_SPACING_DOUBLE
          pNum.leftIndent = 0
          pNum.firstLineIndent = 0
          pNum.spaceBefore = 12
          pNum.spaceAfter = 0

          const pCap = table.insertParagraph(`Título descriptivo de la Tabla ${currentTableNum}`, Word.InsertLocation.before)
          pCap.font.name = FONT_NAME
          pCap.font.size = FONT_SIZE
          pCap.font.italic = true
          pCap.alignment = Word.Alignment.left
          pCap.lineSpacing = LINE_SPACING_DOUBLE
          pCap.leftIndent = 0
          pCap.firstLineIndent = 0
          pCap.spaceAfter = 6
        }
      } catch {
        /* ignore caption insertion error */
      }
      currentTableNum++
    }

    onProgress?.('Centrando y rotulando figuras...', 90)

    // 4. FORMATEAR FIGURAS EN VIVO
    let currentFigNum = 1
    for (const pic of pictures.items) {
      const para = pic.paragraph
      context.load(para, 'text')
      const prev = para.getPreviousOrNullObject()
      context.load(prev, 'text')
    }
    await context.sync()

    for (const pic of pictures.items) {
      const para = pic.paragraph
      para.alignment = Word.Alignment.centered
      para.spaceBefore = 6
      para.spaceAfter = 6
      para.leftIndent = 0
      para.firstLineIndent = 0

      const prev = para.getPreviousOrNullObject()
      const hasCaption = !prev.isNullObject && /^Figura\s+\d+/i.test(prev.text.trim())

      if (!hasCaption) {
        try {
          const pNum = pic.insertParagraph(`Figura ${currentFigNum}`, Word.InsertLocation.before)
          pNum.font.name = FONT_NAME
          pNum.font.size = FONT_SIZE
          pNum.font.bold = true
          pNum.alignment = Word.Alignment.left
          pNum.lineSpacing = LINE_SPACING_DOUBLE
          pNum.leftIndent = 0
          pNum.firstLineIndent = 0
          pNum.spaceBefore = 12
          pNum.spaceAfter = 0

          const pCap = pic.insertParagraph(`Título de la Figura ${currentFigNum}`, Word.InsertLocation.before)
          pCap.font.name = FONT_NAME
          pCap.font.size = FONT_SIZE
          pCap.font.italic = true
          pCap.alignment = Word.Alignment.left
          pCap.lineSpacing = LINE_SPACING_DOUBLE
          pCap.leftIndent = 0
          pCap.firstLineIndent = 0
          pCap.spaceAfter = 6

          const pNote = pic.insertParagraph('', Word.InsertLocation.after)
          const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
          rLabel.font.name = FONT_NAME
          rLabel.font.size = 10
          rLabel.font.italic = true
          const rText = pNote.insertText('Fuente o descripción de la figura.', Word.InsertLocation.end)
          rText.font.name = FONT_NAME
          rText.font.size = 10
          pNote.lineSpacing = LINE_SPACING_DOUBLE
          pNote.leftIndent = 0
          pNote.firstLineIndent = 0
          pNote.spaceBefore = 4
          pNote.spaceAfter = 12
        } catch {
          /* ignore figure caption error */
        }
      }
      currentFigNum++
    }

    onProgress?.('Documento normalizado a APA 7', 100)
    await context.sync()

    return {
      coverDetected: hasCover,
      tocProtected,
      headingsCount,
      paragraphsCount,
      tablesCount: tables.items.length,
      figuresCount: pictures.items.length,
      referencesCount,
    }
  })
}
