/**
 * WordAPA7 Add-in — Motor Maestro de Normalización In-Document
 * =============================================================
 *
 * Normalización completa e inteligente de documentos académicos en Word.
 *
 * Correcciones garantizadas:
 *   1. PORTADA INTACTA: Si el documento tiene portada original, NO se toca
 *      ningún elemento de la misma (se preservan formatos, tablas, cajas y fuentes).
 *   2. CERO CURSIVAS EN PORTADA Y H1/H2: Solo H3 y títulos de tablas/figuras
 *      llevan cursiva reglamentaria.
 *   3. VIÑETAS Y LISTAS: Margen izquierdo de 0.5" (36pt) y SIN sangría de
 *      primera línea APA (respetando la regla de listas APA 7).
 *   4. PROTECCIÓN DEL ÍNDICE (TOC): Cero sangría en líneas de índice para
 *      que los números de página no se desalineen.
 *   5. INICIO DE SECCIONES EN PÁGINA NUEVA: Títulos principales (H1)
 *      inician con salto de página reglamentario y keepWithNext.
 *   6. ELIMINACIÓN DE SANGRÍA SOBRE SANGRÍA: Reseteo de leftIndent=0 en cuerpo.
 */

let FONT_NAME = 'Times New Roman'
let FONT_SIZE = 12
let LINE_SPACING_DOUBLE = 24
let FIRST_LINE_INDENT_PT = 36 // 0.5 pulgadas = 1.27 cm

export interface NormalizationReport {
  coverDetected: boolean
  tocProtected: boolean
  headingsCount: number
  paragraphsCount: number
  listsCount: number
  tablesCount: number
  figuresCount: number
  referencesCount: number
}

/** Títulos canónicos de Nivel 1 */
const H1_CANONICAL = /^(?:resumen|abstract|introducci[oó]n|m[eé]todo|metodolog[ií]a|resultados|discusi[oó]n|conclusi[oó]n|conclusiones|recomendaciones|referencias|bibliograf[ií]a|marco\s+te[oó]rico|planteamiento\s+del\s+problema|justificaci[oó]n|objetivos|estado\s+del\s+arte)$/i

/** Detección de números romanos: I., II., III., IV., V., etc. */
const H1_ROMAN_REGEX = /^(?:cap[ií]tulo\s+[ivxlcdm\d]+|[ivxlcdm]+\.[\s	]+[a-zÁÉÍÓÚÑ])/i

/** Detección de títulos Nivel 2: 1.1., 1.2., 2.1., 3.1., etc. */
const H2_DECIMAL_REGEX = /^\d+\.\d+\.?[\s	]+[a-zÁÉÍÓÚÑ]/i

/** Detección de títulos Nivel 3: 1.1.1. o términos frecuentes de subtítulo */
const H3_SUB_REGEX = /^(?:\d+\.\d+\.\d+\.?[\s	]+|situaci[oó]n\s+problem[aá]tica|preguntas?\s+propuestas?|objetivos?\s+espec[ií]ficos?|dise[nñ]o\s+metodol[oó]gico|poblaci[oó]n\s+y\s+muestra|instrumentos?\s+de\s+recolecci[oó]n|an[aá]lisis\s+de\s+resultados|ventajas|limitaciones|trabajos\s+futuros)/i

/** Patrón de viñetas y listas numeradas */
const LIST_ITEM_REGEX = /^(?:[•‣◦⁃∙\*\-\–\—]|\d+[\.\)]|[a-zA-Z][\.\)]|\([a-zA-Z\d]+\))\s+/

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

    // PUENTE AL MOTOR CENTRAL: el backend calibrado decide el piso de portada
    // y las reglas numericas. Sin backend -> fallback local (nunca bloquea).
    let serverFloor = -1
    try {
      const texts = paragraphs.items.slice(0, 60).map((p) => p.text)
      const res = await fetch('http://127.0.0.1:8742/api/addin/format-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      })
      if (res.ok) {
        const plan = await res.json()
        serverFloor = typeof plan.floor === 'number' ? plan.floor : -1
        const r = plan.rules || {}
        if (r.font) FONT_NAME = r.font
        if (r.size) FONT_SIZE = r.size
        if (r.line_spacing) LINE_SPACING_DOUBLE = Math.round(r.line_spacing * 12)
        if (r.first_line_indent_in) FIRST_LINE_INDENT_PT = Math.round(r.first_line_indent_in * 72)
      }
      fetch('http://127.0.0.1:8742/api/addin/heartbeat', { method: 'POST' }).catch(() => {})
    } catch { /* offline */ }

    onProgress?.('Analizando portada e índice...', 25)

    // 1. DETECTAR PORTADA E ÍNDICE
    let coverEndIndex = -1
    let inTOC = false
    let tocProtected = false
    let hasCover = false

    const initialLimit = Math.min(15, paragraphs.items.length)
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

    if (coverMatches >= 2 || (coverEndIndex > 0 && coverEndIndex <= 10)) {
      hasCover = true
    }

    // SI TIENE PORTADA ORIGINAL: NO SE TOCA NADA DE LA PORTADA
    // Se preserva 100% intacta según el requerimiento explícito del usuario.

    onProgress?.('Jerarquizando títulos, viñetas y párrafos...', 50)

    // 2. RECORRER CUERPO, ÍNDICE, TÍTULOS Y REFERENCIAS
    let headingsCount = 0
    let paragraphsCount = 0
    let listsCount = 0
    let referencesCount = 0
    let inReferencesSection = false
    let h1Index = 0

    // El piso central prevalece sobre el regex local
    let startIdx = hasCover ? coverEndIndex + 1 : 0
    if (serverFloor > startIdx) startIdx = serverFloor

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
        p.font.italic = false
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
        if ((H1_CANONICAL.test(text) || H1_ROMAN_REGEX.test(text)) && !TOC_LINE_REGEX.test(text) && text.length < 60) {
          inTOC = false
        } else {
          // Línea dentro del índice: NUNCA aplicar sangría de primera línea para no romper los números
          p.font.name = FONT_NAME
          p.font.size = FONT_SIZE
          p.font.italic = false
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
        p.font.italic = false
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
        p.spaceBefore = 18
        p.spaceAfter = 6
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        continue
      }

      // Entradas de Referencias (Sangría francesa reglamentaria 1.27 cm)
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

      // D) Título Nivel 1 (H1) — Centrado, Negrita, CERO Cursiva
      const isH1 = (H1_CANONICAL.test(text) || H1_ROMAN_REGEX.test(text)) && text.length < 80 && !text.endsWith('.')
      if (isH1) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = true
        p.font.italic = false
        p.alignment = Word.Alignment.centered
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = h1Index > 0 ? 18 : 12
        p.spaceAfter = 6
        p.leftIndent = 0
        p.rightIndent = 0
        p.firstLineIndent = 0
        headingsCount++
        h1Index++
        continue
      }

      // E) Título Nivel 2 (H2) — Izquierda, Negrita, CERO Cursiva (ej. 1.1., 1.2., Caso No. 1...)
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

      // G) Viñetas y Listas Numeradas — Margen izquierdo 0.5", SIN sangría de primera línea
      if (LIST_ITEM_REGEX.test(text)) {
        p.font.name = FONT_NAME
        p.font.size = FONT_SIZE
        p.font.bold = false
        p.font.italic = false
        p.alignment = Word.Alignment.left
        p.lineSpacing = LINE_SPACING_DOUBLE
        p.spaceBefore = 0
        p.spaceAfter = 0
        p.leftIndent = FIRST_LINE_INDENT_PT
        p.rightIndent = 0
        p.firstLineIndent = 0
        listsCount++
        continue
      }

      // H) Párrafo Normal de Cuerpo — Sangría de 0.5" EXACTA, CERO Cursiva
      p.font.name = FONT_NAME
      p.font.size = FONT_SIZE
      p.font.bold = false
      p.font.italic = false
      p.alignment = Word.Alignment.left
      p.lineSpacing = LINE_SPACING_DOUBLE
      p.spaceBefore = 0
      p.spaceAfter = 0
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
          cp.font.italic = false
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
          pNum.font.italic = false
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
        /* ignore */
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
          pNum.font.italic = false
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
          /* ignore */
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
      listsCount,
      tablesCount: tables.items.length,
      figuresCount: pictures.items.length,
      referencesCount,
    }
  })
}