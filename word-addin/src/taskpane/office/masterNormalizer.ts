/**
 * WordAPA7 Add-in — Motor Maestro de Normalización In-Document
 * =============================================================
 *
 * Normalización completa APA 7 DIRECTAMENTE en Microsoft Word (in-place).
 * Sin emojis, con detección de portada, jerarquización de títulos y cero errores de runtime.
 */

const FONT_NAME = 'Times New Roman'
const FONT_SIZE = 12
const LINE_SPACING_DOUBLE = 24
const FIRST_LINE_INDENT_PT = 36 // 0.5 pulgadas = 1.27 cm

export interface NormalizationReport {
  coverDetected: boolean
  headingsCount: number
  paragraphsCount: number
  tablesCount: number
  figuresCount: number
  referencesCount: number
}

/** Títulos canónicos de Nivel 1 en trabajos académicos en español */
const H1_REGEX = /^(?:resumen|abstract|introducci[oó]n|m[eé]todo|metodolog[ií]a|resultados|discusi[oó]n|conclusi[oó]n|conclusiones|recomendaciones|referencias|bibliograf[ií]a|marco\s+te[oó]rico|planteamiento\s+del\s+problema|justificaci[oó]n|objetivos(?:\s+de\s+la\s+investigaci[oó]n)?|estado\s+del\s+arte)$/i

/** Títulos canónicos de Nivel 2 */
const H2_REGEX = /^(?:participantes|muestra|instrumentos|procedimiento|dise[nñ]o|an[aá]lisis\s+de\s+datos|consideraciones\s+[eé]ticas|limitaciones|trabajos\s+futuros)$/i

/** Patrones de líneas de portada estudiantil */
const COVER_METADATA_REGEX = /(?:autor(?:a)?|estudiante|carrera|facultad|universidad|instituto|profesor(?:a)?|docente|materia|curso|c[aá]tedra|fecha|a[nñ]o\s+acad[eé]mico|\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i

/**
 * Normaliza TODO el documento abierto en Microsoft Word en 1 clic.
 */
export async function normalizeEntireDocumentAPA7(
  onProgress?: (step: string, percent: number) => void
): Promise<NormalizationReport> {
  return await Word.run(async (context) => {
    onProgress?.('Mapeando estructura del documento...', 15)

    const paragraphs = context.document.body.paragraphs
    context.load(paragraphs, 'text,font,firstLineIndent,lineSpacing,alignment')
    const tables = context.document.body.tables
    context.load(tables)
    const pictures = context.document.body.inlinePictures
    context.load(pictures)
    await context.sync()

    onProgress?.('Analizando portada y secciones...', 30)

    // 1. DETECTAR Y MAPEAR PORTADA
    let coverEndIndex = -1
    let hasCover = false

    const initialCheckLimit = Math.min(10, paragraphs.items.length)
    let coverMetaMatches = 0

    for (let i = 0; i < initialCheckLimit; i++) {
      const t = paragraphs.items[i].text.trim()
      if (!t) continue

      if (H1_REGEX.test(t) && !/portada/i.test(t)) {
        break
      }

      if (COVER_METADATA_REGEX.test(t)) {
        coverMetaMatches++
        coverEndIndex = i
      }
    }

    if (coverMetaMatches >= 2 || (coverEndIndex > 0 && coverEndIndex <= 8)) {
      hasCover = true
    }

    // 2. FORMATEAR PORTADA (Centrada, doble espacio, SIN sangría de primera línea)
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
        p.firstLineIndent = 0
        p.alignment = Word.Alignment.centered

        // Título de portada: Negrita
        if (i === 0 || (i === 1 && !paragraphs.items[0].text.trim())) {
          p.font.bold = true
        } else {
          p.font.bold = false
        }
      }
    }

    onProgress?.('Jerarquizando títulos y párrafos...', 55)

    // 3. FORMATEAR CUERPO, TÍTULOS Y REFERENCIAS
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

      // A) Detección de Sección de Referencias
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
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // B) Formato de Entradas de Referencias (Hanging Indent)
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
        referencesCount++
        continue
      }

      // C) Detección de Rótulos de Tablas y Figuras
      if (/^Tabla\s+\d+/i.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
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
        p.firstLineIndent = 0
        p.spaceBefore = 4
        p.spaceAfter = 12
        continue
      }

      // D) Detección de Títulos de Nivel 1 (H1)
      const isNumberedH1 = /^(?:cap[ií]tulo\s+[ivxlcdm\d]+|\d+[\.\s]+[a-zÁÉÍÓÚÑ])/i.test(text) && text.length < 80 && !text.endsWith('.')
      const isCanonicalH1 = H1_REGEX.test(text)

      if (isCanonicalH1 || isNumberedH1) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.centered
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 12
        p.spaceAfter = 6
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // E) Detección de Títulos de Nivel 2 (H2)
      const isNumberedH2 = /^\d+\.\d+\s+[a-zÁÉÍÓÚÑ]/i.test(text) && text.length < 90 && !text.endsWith('.')
      const isCanonicalH2 = H2_REGEX.test(text)

      if (isCanonicalH2 || isNumberedH2) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 12
        p.spaceAfter = 4
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // F) Párrafo Normal de Cuerpo
      p.font.name = FONT_NAME
      p.font.size = FONT_SIZE
      p.font.bold = false
      p.font.italic = false
      p.alignment = Word.Alignment.left
      p.lineSpacing = LINE_SPACING_DOUBLE
      p.spaceBefore = 0
      p.spaceAfter = 0
      p.firstLineIndent = FIRST_LINE_INDENT_PT
      paragraphsCount++
    }

    onProgress?.('Formateando tablas reglamentarias...', 75)

    // 4. FORMATEAR TABLAS EN VIVO
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
          cp.firstLineIndent = 0
          if (isHeader) {
            cp.font.bold = true
            cp.alignment = Word.Alignment.left
          }
        }
      }

      try {
        table.alignment = Word.Alignment.centered
      } catch { /* ignore */ }

      const tableRange = table.getRange(Word.RangeLocation.whole)
      const firstPara = tableRange.paragraphs.getFirstOrNullObject()
      const prevPara = firstPara.getPreviousOrNullObject()
      context.load(prevPara, 'text')
      await context.sync()

      const hasCaption = !prevPara.isNullObject && /^Tabla\s+\d+/i.test(prevPara.text.trim())
      if (!hasCaption) {
        const pNum = tableRange.insertParagraph(`Tabla ${currentTableNum}`, Word.InsertLocation.before)
        pNum.font.name = FONT_NAME
        pNum.font.size = FONT_SIZE
        pNum.font.bold = true
        pNum.alignment = Word.Alignment.left
        pNum.lineSpacing = LINE_SPACING_DOUBLE
        pNum.spaceBefore = 12
        pNum.spaceAfter = 0

        const pCap = tableRange.insertParagraph(`Título de la Tabla ${currentTableNum}`, Word.InsertLocation.before)
        pCap.font.name = FONT_NAME
        pCap.font.size = FONT_SIZE
        pCap.font.italic = true
        pCap.alignment = Word.Alignment.left
        pCap.lineSpacing = LINE_SPACING_DOUBLE
        pCap.spaceAfter = 6
      }
      currentTableNum++
    }

    onProgress?.('Centrando y rotulando figuras...', 90)

    // 5. FORMATEAR FIGURAS EN VIVO
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

      const prev = para.getPreviousOrNullObject()
      const hasCaption = !prev.isNullObject && /^Figura\s+\d+/i.test(prev.text.trim())

      if (!hasCaption) {
        const pNum = pic.insertParagraph(`Figura ${currentFigNum}`, Word.InsertLocation.before)
        pNum.font.name = FONT_NAME
        pNum.font.size = FONT_SIZE
        pNum.font.bold = true
        pNum.alignment = Word.Alignment.left
        pNum.lineSpacing = LINE_SPACING_DOUBLE
        pNum.spaceBefore = 12
        pNum.spaceAfter = 0

        const pCap = pic.insertParagraph(`Título de la Figura ${currentFigNum}`, Word.InsertLocation.before)
        pCap.font.name = FONT_NAME
        pCap.font.size = FONT_SIZE
        pCap.font.italic = true
        pCap.alignment = Word.Alignment.left
        pCap.lineSpacing = LINE_SPACING_DOUBLE
        pCap.spaceAfter = 6

        const pNote = pic.insertParagraph('', Word.InsertLocation.after)
        const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
        rLabel.font.name = FONT_NAME
        rLabel.font.size = 10
        rLabel.font.italic = true
        const rText = pNote.insertText('Fuente o descripción general de la figura.', Word.InsertLocation.end)
        rText.font.name = FONT_NAME
        rText.font.size = 10
        pNote.lineSpacing = LINE_SPACING_DOUBLE
        pNote.spaceBefore = 4
        pNote.spaceAfter = 12
      }
      currentFigNum++
    }

    onProgress?.('Documento normalizado a APA 7', 100)
    await context.sync()

    return {
      coverDetected: hasCover,
      headingsCount,
      paragraphsCount,
      tablesCount: tables.items.length,
      figuresCount: pictures.items.length,
      referencesCount,
    }
  })
}
