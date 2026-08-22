/**
 * WordAPA7 Add-in — Office.js Word Helpers (Asistente en Vivo) — CANÓNICO
 * ==================================================================
 *
 * Fuente única de verdad para TODA interacción con el documento de Word vía
 * Office.js (WordApi). Incluye:
 *
 *  - Lectura del documento (texto, párrafos, estadísticas)
 *  - Formato APA 7 "al vuelo" (fuente, interlineado doble, márgenes, sangría)
 *  - Inserción de tablas, figuras, títulos, bibliografía y portada
 *  - Auto-numeración y auto-caption de figuras/tablas (detección al pegar)
 *  - Suscripción a cambios del documento (el "ojo" del asistente en vivo)
 *
 * Convención: todas las funciones devuelven Promise y lanzan errores con
 * mensajes en español para que el panel los muestre al usuario.
 *
 * Requisitos: WordApi 1.3 (getPreviousOrNullObject, getFirst/getLast,
 * inlinePictures, tablas) + Common API DocumentChanged event.
 */

// ── TIPOS LOCALES ────────────────────────────────────────────────────────────

export interface TableData {
  headers: string[]
  rows: string[][]
  caption: string
  note?: string
}

export interface FigureData {
  /** base64 SIN el prefijo data: */
  imageBase64: string
  caption: string
  note?: string
  widthInches?: number
  altText?: string
}

export interface HeadingData {
  text: string
  level: 1 | 2 | 3 | 4 | 5
}

export interface HeadingConfig {
  bold: boolean
  italic: boolean
  alignment: Word.Alignment
  indentCm: number
  inlineText: boolean
  label: string
}

export interface DocumentStats {
  words: number
  figures: number
  tables: number
  paragraphs: number
  inlinePictures: number
}

export interface Unsubscription {
  (): void
}

// ── CONSTANTES APA 7 ──────────────────────────────────────────────────────────

const FONT_NAME = 'Times New Roman'
const FONT_SIZE = 12
/** Interlineado doble en "puntos Office" (24 / 12 = 2.0 líneas) */
const LINE_SPACING_DOUBLE = 24
/** Sangría primera línea 0.5" = 36 pt */
const FIRST_LINE_INDENT_PT = 36
/** Margen 1" = 72 pt */
const MARGIN_INCH_PT = 72
/** 1 pulgada en puntos */
const PT_PER_INCH = 72

/**
 * Configuración de los 5 niveles de heading APA 7.
 * Usado tanto para insertar títulos como para aplicar formato detectado.
 */
export const HEADING_CONFIGS: Record<number, HeadingConfig> = {
  1: { bold: true, italic: false, alignment: Word.Alignment.centered, indentCm: 0, inlineText: false, label: 'Nivel 1 — Centrado, negrita' },
  2: { bold: true, italic: false, alignment: Word.Alignment.left, indentCm: 0, inlineText: false, label: 'Nivel 2 — Izquierda, negrita' },
  3: { bold: true, italic: true, alignment: Word.Alignment.left, indentCm: 0, inlineText: false, label: 'Nivel 3 — Izquierda, negrita + cursiva' },
  4: { bold: true, italic: false, alignment: Word.Alignment.left, indentCm: 0.5, inlineText: true, label: 'Nivel 4 — Sangría, negrita, en línea' },
  5: { bold: true, italic: true, alignment: Word.Alignment.left, indentCm: 0.5, inlineText: true, label: 'Nivel 5 — Sangría, negrita + cursiva, en línea' },
}

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────

let _officeReady = false

export function ensureOfficeReady(): Promise<void> {
  return new Promise((resolve) => {
    if (_officeReady) return resolve()
    Office.onReady(() => {
      _officeReady = true
      resolve()
    })
  })
}

// ── HELPERS INTERNOS ─────────────────────────────────────────────────────────

/**
 * Ejecuta un callback dentro de un Word.run sincronizado.
 * Captura errores y los relanza en español.
 */
async function withWordContext<T>(
  fn: (context: Word.RequestContext) => Promise<T>,
): Promise<T> {
  try {
    return await Word.run(async (context) => {
      const result = await fn(context)
      await context.sync()
      return result
    })
  } catch (error: any) {
    const msg = error?.message || String(error)
    // Office.js lanza "ItemNotFound" cuando no hay elementos; traducirlo.
    if (/ItemNotFound|RichApi\.Error/i.test(msg)) {
      throw new Error('No se encontró el elemento en el documento.')
    }
    throw new Error(`Error de Word: ${msg}`)
  }
}

/** Aplica fuente APA 7 (Times New Roman 12pt) a un objeto con .font */
function applyFont(font: Word.Font, size: number = FONT_SIZE): void {
  font.name = FONT_NAME
  font.size = size
}

/** Convierte centímetros a puntos (1 cm ≈ 28.35 pt). */
function cmToPt(cm: number): number {
  return Math.round(cm * 28.3465)
}

// ── LECTURA DEL DOCUMENTO ────────────────────────────────────────────────────

/** Lee todo el texto del documento actual. */
export async function getDocumentText(): Promise<string> {
  return withWordContext(async (context) => {
    const body = context.document.body
    body.load('text')
    await context.sync()
    return body.text
  })
}

/** Lee el texto seleccionado actualmente. */
export async function getSelectedText(): Promise<string> {
  return withWordContext(async (context) => {
    const range = context.document.getSelection()
    range.load('text')
    await context.sync()
    return range.text
  })
}

/**
 * Lee todos los párrafos del documento como array de strings.
 * Útil para detección de headings y análisis de estructura.
 */
export async function getParagraphsForAnalysis(): Promise<string[]> {
  return withWordContext(async (context) => {
    const paragraphs = context.document.body.paragraphs
    context.load(paragraphs, 'text')
    await context.sync()
    return paragraphs.items.map((p) => p.text)
  })
}

export interface HeadingItem {
  index: number
  text: string
  level: number
}

export async function getDocumentHeadings(): Promise<HeadingItem[]> {
  return withWordContext(async (context) => {
    const paragraphs = context.document.body.paragraphs
    // En algunas versiones de WordApi styleBuiltIn puede fallar si no se pide style también
    context.load(paragraphs, 'styleBuiltIn, text, style')
    await context.sync()
    
    const headings: HeadingItem[] = []
    paragraphs.items.forEach((p, index) => {
      // Intentamos usar styleBuiltIn, y si no, style (como string)
      const style = String(p.styleBuiltIn || p.style || '').replace(/\s+/g, '')
      let level = 0
      if (style.includes('Heading1')) level = 1
      else if (style.includes('Heading2')) level = 2
      else if (style.includes('Heading3')) level = 3
      else if (style.includes('Heading4')) level = 4
      else if (style.includes('Heading5')) level = 5
      
      if (level > 0 && p.text.trim()) {
        headings.push({ index, text: p.text.trim(), level })
      }
    })
    return headings
  })
}

export async function navigateToParagraph(index: number): Promise<void> {
  await withWordContext(async (context) => {
    const paragraphs = context.document.body.paragraphs
    context.load(paragraphs)
    await context.sync()
    if (index >= 0 && index < paragraphs.items.length) {
      const p = paragraphs.items[index]
      p.select()
    }
  })
}

/** Cuenta figuras y tablas existentes (por texto "Figura N" / "Tabla N"). */
export async function countFiguresAndTables(): Promise<{ figures: number; tables: number }> {
  const text = await getDocumentText()
  const figureMatches = text.match(/Figura\s+(\d+)/gi) || []
  const figureNumbers = figureMatches.map((m) => parseInt(m.match(/\d+/)?.[0] || '0', 10))
  const figures = figureNumbers.length > 0 ? Math.max(...figureNumbers) : 0

  const tableMatches = text.match(/Tabla\s+(\d+)/gi) || []
  const tableNumbers = tableMatches.map((m) => parseInt(m.match(/\d+/)?.[0] || '0', 10))
  const tables = tableNumbers.length > 0 ? Math.max(...tableNumbers) : 0

  return { figures, tables }
}

/** Calcula el próximo número de figura basado en el texto del documento. */
export async function getNextFigureNumber(): Promise<number> {
  const { figures } = await countFiguresAndTables()
  return figures + 1
}

/** Calcula el próximo número de tabla basado en el texto del documento. */
export async function getNextTableNumber(): Promise<number> {
  const { tables } = await countFiguresAndTables()
  return tables + 1
}

/** Estadísticas del documento (palabras, figuras, tablas, párrafos, imágenes). */
export async function getDocumentStats(): Promise<DocumentStats> {
  return withWordContext(async (context) => {
    const body = context.document.body
    const paragraphs = body.paragraphs
    const inlinePictures = body.inlinePictures
    body.load('text')
    context.load(paragraphs)
    context.load(inlinePictures)
    await context.sync()

    const words = body.text.trim().split(/\s+/).filter(Boolean).length
    const figures = (body.text.match(/Figura\s+\d+/gi) || []).length
    const tables = (body.text.match(/Tabla\s+\d+/gi) || []).length

    return {
      words,
      figures,
      tables,
      paragraphs: paragraphs.items.length,
      inlinePictures: inlinePictures.items.length,
    }
  })
}

// ── FORMATO APA 7 AL VUELO ───────────────────────────────────────────────────

/**
 * Aplica formato APA 7 a un objeto Paragraph:
 *   - Times New Roman 12pt
 *   - Interlineado doble (2.0)
 *   - Sangría primera línea 0.5" (opcional, solo si indent=true)
 *   - Sin espacio antes/después
 */
function formatParagraphAPA(
  para: Word.Paragraph,
  opts: { indent?: boolean; alignment?: Word.Alignment } = {},
): void {
  applyFont(para.font)
  para.lineSpacing = LINE_SPACING_DOUBLE
  para.spaceAfter = 0
  para.spaceBefore = 0
  if (opts.indent) {
    para.firstLineIndent = FIRST_LINE_INDENT_PT
  }
  if (opts.alignment !== undefined) {
    para.alignment = opts.alignment
  }
}

/**
 * Aplica formato APA 7 al párrafo donde está el cursor (formato al vuelo).
 * Es la operación que dispara el asistente en vivo cuando el usuario escribe.
 */
export async function applyAPA7ToCurrentParagraph(indent = true): Promise<void> {
  await withWordContext(async (context) => {
    const para = context.document.getSelection().paragraphs.getFirst()
    formatParagraphAPA(para, { indent })
  })
}

/**
 * Aplica formato APA 7 a todos los párrafos dentro de la selección actual.
 */
export async function applyAPA7ToSelection(indent = true): Promise<void> {
  await withWordContext(async (context) => {
    const paragraphs = context.document.getSelection().paragraphs
    context.load(paragraphs)
    await context.sync()
    for (const para of paragraphs.items) {
      formatParagraphAPA(para, { indent })
    }
  })
}

/**
 * Aplica formato APA 7 a TODO el documento:
 *   - Fuente + interlineado doble en todos los párrafos
 *   - Márgenes de 1" (2.54 cm) en todas las secciones
 *   - Sangría de primera línea en párrafos de cuerpo
 */
export async function formatDocumentAPA7(indent = true): Promise<void> {
  await withWordContext(async (context) => {
    const sections = context.document.sections
    context.load(sections)
    const paragraphs = context.document.body.paragraphs
    context.load(paragraphs)
    await context.sync()

    // Márgenes APA 7 (1 pulgada) en todas las secciones
    for (const section of sections.items) {
      const ps = section.pageSetup
      ps.topMargin = MARGIN_INCH_PT
      ps.bottomMargin = MARGIN_INCH_PT
      ps.leftMargin = MARGIN_INCH_PT
      ps.rightMargin = MARGIN_INCH_PT
    }

    // Formato de párrafos
    for (const para of paragraphs.items) {
      formatParagraphAPA(para, { indent })
    }
  })
}

/** Aplica solo márgenes APA 7 (1") a todo el documento. */
export async function applyMarginsAPA(): Promise<void> {
  await withWordContext(async (context) => {
    const sections = context.document.sections
    context.load(sections)
    await context.sync()
    for (const section of sections.items) {
      const ps = section.pageSetup
      ps.topMargin = MARGIN_INCH_PT
      ps.bottomMargin = MARGIN_INCH_PT
      ps.leftMargin = MARGIN_INCH_PT
      ps.rightMargin = MARGIN_INCH_PT
    }
  })
}

/**
 * Aplica el estilo de heading APA 7 (nivel 1-5) al párrafo donde está el cursor.
 *   Nivel 1: Centrado, negrita
 *   Nivel 2: Izquierda, negrita
 *   Nivel 3: Izquierda, negrita + cursiva
 *   Nivel 4: Sangría, negrita, en línea
 *   Nivel 5: Sangría, negrita + cursiva, en línea
 */
export async function applyHeadingStyle(level: 1 | 2 | 3 | 4 | 5): Promise<void> {
  await withWordContext(async (context) => {
    const para = context.document.getSelection().paragraphs.getFirst()
    const cfg = HEADING_CONFIGS[level]
    applyFont(para.font)
    para.font.bold = cfg.bold
    para.font.italic = cfg.italic
    para.alignment = cfg.alignment
    para.lineSpacing = LINE_SPACING_DOUBLE
    para.spaceBefore = 0
    para.spaceAfter = 0
    para.firstLineIndent = 0
    para.leftIndent = cfg.indentCm > 0 ? cmToPt(cfg.indentCm) : 0
  })
}

// ── INSERCIÓN DE ELEMENTOS APA 7 ─────────────────────────────────────────────

/**
 * Inserta una tabla con formato APA 7 en la selección/cursor:
 *   1. "Tabla N" en negrita
 *   2. Título de la tabla en cursiva
 *   3. Tabla con encabezados en negrita
 *   4. Nota al pie (opcional)
 */
export async function insertTableAPA(data: TableData, tableNumber: number): Promise<void> {
  await withWordContext(async (context) => {
    // Insertar en la selección/cursor (no al final del documento)
    const sel = context.document.getSelection()

    // 1. "Tabla N" en negrita
    const pNum = sel.insertParagraph(`Tabla ${tableNumber}`, Word.InsertLocation.after)
    applyFont(pNum.font)
    pNum.font.bold = true
    pNum.alignment = Word.Alignment.left
    pNum.lineSpacing = LINE_SPACING_DOUBLE
    pNum.spaceAfter = 0

    // 2. Título en cursiva
    let anchor: Word.Paragraph = pNum
    if (data.caption) {
      const pCap = pNum.insertParagraph(data.caption, Word.InsertLocation.after)
      applyFont(pCap.font)
      pCap.font.italic = true
      pCap.alignment = Word.Alignment.left
      pCap.lineSpacing = LINE_SPACING_DOUBLE
      pCap.spaceAfter = 6
      anchor = pCap
    }

    // 3. Tabla (insertTable con valores 2D) — después del título
    const values: string[][] = []
    if (data.headers.length > 0) values.push(data.headers)
    for (const row of data.rows) values.push(row)

    const rowCount = Math.max(values.length, 1)
    const colCount = data.headers.length || data.rows[0]?.length || 1

    const table = anchor.getRange().insertTable(rowCount, colCount, Word.InsertLocation.after, values)

    // Formato de celdas: TNR 12; encabezados en negrita.
    const rows = table.rows
    context.load(rows)
    await context.sync()

    for (let ri = 0; ri < rows.items.length; ri++) {
      const cells = rows.items[ri].cells
      context.load(cells)
    }
    await context.sync()

    for (let ri = 0; ri < rows.items.length; ri++) {
      const isHeader = data.headers.length > 0 && ri === 0
      const cells = rows.items[ri].cells.items
      for (const cell of cells) {
        const p = cell.body.paragraphs.getFirst()
        applyFont(p.font)
        if (isHeader) p.font.bold = true
      }
    }

    // 4. Nota al pie (después de la tabla)
    if (data.note) {
      const pNote = table.getRange(Word.RangeLocation.after).insertParagraph('', Word.InsertLocation.after)
      const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
      rLabel.font.italic = true
      applyFont(rLabel.font, 10)
      const rText = pNote.insertText(data.note, Word.InsertLocation.end)
      applyFont(rText.font, 10)
      pNote.lineSpacing = LINE_SPACING_DOUBLE
      pNote.spaceBefore = 4
    }

    // Párrafo separador
    const pSep = table.getRange(Word.RangeLocation.after).insertParagraph('', Word.InsertLocation.after)
    pSep.lineSpacing = LINE_SPACING_DOUBLE
  })
}

/**
 * Inserta una figura con formato APA 7 en la selección/cursor:
 *   1. "Figura N" en negrita
 *   2. Título de la figura en cursiva
 *   3. Imagen centrada
 *   4. Nota al pie (opcional)
 */
export async function insertFigureAPA(data: FigureData, figureNumber: number): Promise<void> {
  await withWordContext(async (context) => {
    // Insertar en la selección/cursor (no al final del documento)
    const sel = context.document.getSelection()

    // 1. "Figura N" en negrita
    const pNum = sel.insertParagraph(`Figura ${figureNumber}`, Word.InsertLocation.after)
    applyFont(pNum.font)
    pNum.font.bold = true
    pNum.alignment = Word.Alignment.left
    pNum.lineSpacing = LINE_SPACING_DOUBLE
    pNum.spaceBefore = 12
    pNum.spaceAfter = 0

    // 2. Título en cursiva
    let anchor: Word.Paragraph = pNum
    if (data.caption) {
      const pCap = pNum.insertParagraph(data.caption, Word.InsertLocation.after)
      applyFont(pCap.font)
      pCap.font.italic = true
      pCap.alignment = Word.Alignment.left
      pCap.lineSpacing = LINE_SPACING_DOUBLE
      pCap.spaceAfter = 6
      anchor = pCap
    }

    // 3. Imagen centrada (insertInlinePictureFromBase64 + ajuste de ancho)
    const pImg = anchor.getRange().insertParagraph('', Word.InsertLocation.after)
    pImg.alignment = Word.Alignment.centered
    pImg.lineSpacing = LINE_SPACING_DOUBLE
    pImg.spaceBefore = 6
    pImg.spaceAfter = 6

    const widthPt = data.widthInches ? data.widthInches * PT_PER_INCH : 6 * PT_PER_INCH
    const picture = pImg.insertInlinePictureFromBase64(data.imageBase64, Word.InsertLocation.end)
    picture.lockAspectRatio = true
    picture.width = widthPt
    if (data.altText) {
      try {
        picture.altTextDescription = data.altText
        picture.altTextTitle = data.altText
      } catch {
        /* altText no soportado en algunas versiones */
      }
    }

    // 4. Nota al pie (después de la imagen)
    if (data.note) {
      const pNote = pImg.getRange(Word.RangeLocation.after).insertParagraph('', Word.InsertLocation.after)
      const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
      rLabel.font.italic = true
      applyFont(rLabel.font, 10)
      const rText = pNote.insertText(data.note, Word.InsertLocation.end)
      applyFont(rText.font, 10)
      pNote.lineSpacing = LINE_SPACING_DOUBLE
      pNote.spaceBefore = 4
    }

    // Párrafo separador
    const pSep = pImg.getRange(Word.RangeLocation.after).insertParagraph('', Word.InsertLocation.after)
    pSep.lineSpacing = LINE_SPACING_DOUBLE
  })
}

/**
 * Inserta un heading APA 7 en la selección/cursor con el nivel indicado.
 */
export async function insertHeadingAPA(text: string, level: 1 | 2 | 3 | 4 | 5): Promise<void> {
  await withWordContext(async (context) => {
    // Insertar en la selección/cursor (no al final del documento)
    const sel = context.document.getSelection()
    const heading = sel.insertParagraph(text, Word.InsertLocation.after)
    const cfg = HEADING_CONFIGS[level]
    applyFont(heading.font)
    heading.font.bold = cfg.bold
    heading.font.italic = cfg.italic
    heading.alignment = cfg.alignment
    heading.lineSpacing = LINE_SPACING_DOUBLE
    heading.spaceAfter = 0
    heading.firstLineIndent = 0
    heading.leftIndent = cfg.indentCm > 0 ? cmToPt(cfg.indentCm) : 0
  })
}

/** Inserta un salto de página. */
export async function insertPageBreakAPA(): Promise<void> {
  await withWordContext(async (context) => {
    context.document.body.insertBreak(Word.BreakType.page, Word.InsertLocation.end)
  })
}

/**
 * Inserta una cita en texto (ej. "(García, 2023)") en la selección/cursor.
 * Si hay texto seleccionado, lo reemplaza; si el cursor está colapsado, inserta.
 */
export async function insertCitationAtCursor(citation: string): Promise<void> {
  await withWordContext(async (context) => {
    const sel = context.document.getSelection()
    sel.insertText(citation, Word.InsertLocation.replace)
  })
}

/**
 * Inserta o actualiza la sección de Referencias:
 *   - Si ya existe un párrafo "Referencias", reemplaza su contenido (dedup).
 *   - Si no, agrega salto de página + título al final.
 *   - Cada referencia en su propio párrafo con sangría francesa.
 *
 * @param text Texto completo de la bibliografía (una referencia por línea).
 */
export async function insertBibliographyAPA(text: string): Promise<void> {
  await withWordContext(async (context) => {
    const body = context.document.body
    const paragraphs = body.paragraphs
    context.load(paragraphs, 'text')
    await context.sync()

    const refs = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    // ¿Ya existe una sección "Referencias"?
    let titlePara: Word.Paragraph | null = null
    for (const p of paragraphs.items) {
      if (p.text.trim().toLowerCase() === 'referencias') {
        titlePara = p
        break
      }
    }

    if (titlePara) {
      // Reaplicar formato APA al título y borrar lo que sigue
      applyFont(titlePara.font)
      titlePara.font.bold = true
      titlePara.alignment = Word.Alignment.centered
      titlePara.lineSpacing = LINE_SPACING_DOUBLE
      titlePara.spaceAfter = 0

      const afterRange = titlePara.getRange(Word.RangeLocation.after)
      afterRange.delete()
      await context.sync()

      let prev: Word.Paragraph = titlePara
      for (const ref of refs) {
        const pRef = prev.insertParagraph(ref, Word.InsertLocation.after)
        applyFont(pRef.font)
        pRef.alignment = Word.Alignment.left
        pRef.lineSpacing = LINE_SPACING_DOUBLE
        pRef.leftIndent = FIRST_LINE_INDENT_PT // 0.5"
        pRef.firstLineIndent = -FIRST_LINE_INDENT_PT // sangría francesa
        pRef.spaceAfter = 0
        pRef.spaceBefore = 0
        prev = pRef
      }
      return
    }

    // No existe: salto de página + título al final
    body.insertBreak(Word.BreakType.page, Word.InsertLocation.end)
    const pTitle = body.insertParagraph('Referencias', Word.InsertLocation.end)
    applyFont(pTitle.font)
    pTitle.font.bold = true
    pTitle.alignment = Word.Alignment.centered
    pTitle.lineSpacing = LINE_SPACING_DOUBLE
    pTitle.spaceAfter = 0

    let prev: Word.Paragraph = pTitle
    for (const ref of refs) {
      const pRef = prev.insertParagraph(ref, Word.InsertLocation.after)
      applyFont(pRef.font)
      pRef.alignment = Word.Alignment.left
      pRef.lineSpacing = LINE_SPACING_DOUBLE
      pRef.leftIndent = FIRST_LINE_INDENT_PT
      pRef.firstLineIndent = -FIRST_LINE_INDENT_PT
      pRef.spaceAfter = 0
      pRef.spaceBefore = 0
      prev = pRef
    }
  })
}

export interface CoverFields {
  title: string
  author: string
  institution: string
  course: string
  date: string
}

/**
 * Inserta una portada APA 7 (estudiante) al INICIO del documento con los 5
 * campos: Título, Nombre, Institución, Curso, Fecha.
 */
export async function insertCoverPageAPA(fields: CoverFields): Promise<void> {
  await withWordContext(async (context) => {
    const body = context.document.body

    // Espacios iniciales (≈ 4 líneas dobles en blanco para centrar verticalmente)
    for (let i = 0; i < 4; i++) {
      const p = body.insertParagraph('', Word.InsertLocation.start)
      p.lineSpacing = LINE_SPACING_DOUBLE
    }

    // Título (centrado, negrita, Title Case)
    const pTitle = body.insertParagraph(fields.title || 'Título del Trabajo', Word.InsertLocation.start)
    applyFont(pTitle.font)
    pTitle.font.bold = true
    pTitle.alignment = Word.Alignment.centered
    pTitle.lineSpacing = LINE_SPACING_DOUBLE

    // Autor
    const pAuthor = body.insertParagraph(fields.author || 'Nombre del Autor', Word.InsertLocation.end)
    applyFont(pAuthor.font)
    pAuthor.alignment = Word.Alignment.centered
    pAuthor.lineSpacing = LINE_SPACING_DOUBLE

    // Institución
    const pInst = body.insertParagraph(fields.institution || 'Institución', Word.InsertLocation.end)
    applyFont(pInst.font)
    pInst.alignment = Word.Alignment.centered
    pInst.lineSpacing = LINE_SPACING_DOUBLE

    // Curso
    const pCourse = body.insertParagraph(fields.course || 'Curso', Word.InsertLocation.end)
    applyFont(pCourse.font)
    pCourse.alignment = Word.Alignment.centered
    pCourse.lineSpacing = LINE_SPACING_DOUBLE

    // Fecha
    const pDate = body.insertParagraph(fields.date || 'Fecha', Word.InsertLocation.end)
    applyFont(pDate.font)
    pDate.alignment = Word.Alignment.centered
    pDate.lineSpacing = LINE_SPACING_DOUBLE

    // Salto de página después de la portada
    body.insertParagraph('', Word.InsertLocation.end).insertBreak(Word.BreakType.page, Word.InsertLocation.after)
  })
}

/**
 * Inserta un comentario de revisión nativo de Word en la selección actual.
 */
export async function addWordComment(commentText: string): Promise<void> {
  await withWordContext(async (context) => {
    const range = context.document.getSelection()
    range.insertComment(commentText)
  })
}

// ── AUTO-CAPTION DE FIGURAS/TABLAS (DETECCIÓN AL PEGAR) ──────────────────────

const RE_FIGURE_LABEL = /^Figura\s+\d+/i
const RE_TABLE_LABEL = /^Tabla\s+\d+/i

/**
 * Detecta imágenes inline que NO tienen un caption "Figura N" en el párrafo
 * anterior, y les inserta automáticamente el caption APA 7 + nota.
 *
 * Es idempotente: solo captiona imágenes sin caption previo.
 *
 * @param suggestTitle callback opcional (async) para generar el título en
 *        cursiva vía IA a partir del contexto. Si se omite, usa un placeholder.
 * @returns cantidad de figuras nuevas captionadas.
 */
export async function captionUncaptionedFigures(
  suggestTitle?: (ctx: string) => Promise<string>,
): Promise<number> {
  let captioned = 0
  let nextNum = await getNextFigureNumber()

  await withWordContext(async (context) => {
    const pictures = context.document.body.inlinePictures
    context.load(pictures)
    await context.sync()

    // Primera pasada: cargar texto del párrafo y del anterior
    for (const pic of pictures.items) {
      const para = pic.paragraph
      context.load(para, 'text')
      const prev = para.getPreviousOrNullObject()
      context.load(prev, 'text')
    }
    await context.sync()

    // Segunda pasada: insertar captions donde falten
    for (const pic of pictures.items) {
      const para = pic.paragraph
      const prev = para.getPreviousOrNullObject()
      if (!prev.isNullObject && RE_FIGURE_LABEL.test(prev.text.trim())) {
        continue // ya tiene caption
      }

      // "Figura N" en negrita (antes de la imagen)
      const pNum = pic.insertParagraph(`Figura ${nextNum}`, Word.InsertLocation.before)
      applyFont(pNum.font)
      pNum.font.bold = true
      pNum.alignment = Word.Alignment.left
      pNum.lineSpacing = LINE_SPACING_DOUBLE
      pNum.spaceAfter = 0

      // Título en cursiva (sugerido por IA o placeholder)
      let titleText = `Título de la Figura ${nextNum}`
      if (suggestTitle) {
        try {
          const suggested = await suggestTitle(para.text || '')
          if (suggested) titleText = suggested
        } catch {
          /* fallback al placeholder */
        }
      }
      const pCap = pic.insertParagraph(titleText, Word.InsertLocation.before)
      applyFont(pCap.font)
      pCap.font.italic = true
      pCap.alignment = Word.Alignment.left
      pCap.lineSpacing = LINE_SPACING_DOUBLE
      pCap.spaceAfter = 6

      // Nota vacía debajo
      const pNote = pic.insertParagraph('', Word.InsertLocation.after)
      const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
      rLabel.font.italic = true
      applyFont(rLabel.font, 10)
      pNote.lineSpacing = LINE_SPACING_DOUBLE
      pNote.spaceBefore = 4

      nextNum++
      captioned++
    }
  })

  return captioned
}

/**
 * Detecta tablas que NO tienen un caption "Tabla N" en el párrafo anterior,
 * y les inserta automáticamente el caption APA 7 + nota.
 *
 * @returns cantidad de tablas nuevas captionadas.
 */
export async function captionUncaptionedTables(): Promise<number> {
  let captioned = 0
  let nextNum = await getNextTableNumber()

  await withWordContext(async (context) => {
    const tables = context.document.body.tables
    context.load(tables)
    await context.sync()

    for (const table of tables.items) {
      const range = table.getRange(Word.RangeLocation.whole)
      const firstPara = range.paragraphs.getFirstOrNullObject()
      const prevPara = firstPara.getPreviousOrNullObject()
      context.load(prevPara, 'text')
    }
    await context.sync()

    for (const table of tables.items) {
      const range = table.getRange(Word.RangeLocation.whole)
      const firstPara = range.paragraphs.getFirstOrNullObject()
      const prevPara = firstPara.getPreviousOrNullObject()
      if (!prevPara.isNullObject && RE_TABLE_LABEL.test(prevPara.text.trim())) {
        continue // ya tiene caption
      }

      // Insertar caption ANTES de la tabla
      const pNum = range.insertParagraph(`Tabla ${nextNum}`, Word.InsertLocation.before)
      applyFont(pNum.font)
      pNum.font.bold = true
      pNum.alignment = Word.Alignment.left
      pNum.lineSpacing = LINE_SPACING_DOUBLE
      pNum.spaceAfter = 0

      const pCap = table.getRange(Word.RangeLocation.whole).insertParagraph(
        `Título de la Tabla ${nextNum}`,
        Word.InsertLocation.before,
      )
      applyFont(pCap.font)
      pCap.font.italic = true
      pCap.alignment = Word.Alignment.left
      pCap.lineSpacing = LINE_SPACING_DOUBLE
      pCap.spaceAfter = 6

      // Nota debajo de la tabla
      const pNote = table.getRange(Word.RangeLocation.whole).insertParagraph(
        '',
        Word.InsertLocation.after,
      )
      const rLabel = pNote.insertText('Nota. ', Word.InsertLocation.end)
      rLabel.font.italic = true
      applyFont(rLabel.font, 10)
      pNote.lineSpacing = LINE_SPACING_DOUBLE
      pNote.spaceBefore = 4

      nextNum++
      captioned++
    }
  })

  return captioned
}

// ── SUSCRIPCIÓN A CAMBIOS DEL DOCUMENTO (EL "OJO" DEL ASISTENTE) ─────────────

// Office.EventType.DocumentChanged no existe en @types/office-js antiguos,
// pero sí en el host de Word real (valor "documentChanged"). Se castea.
const DOCUMENT_CHANGED_EVENT = (Office.EventType as any).DocumentChanged as Office.EventType

/**
 * Se suscribe al evento DocumentChanged (cualquier cambio de contenido del
 * documento, incluido pegar imágenes/tablas/escribir texto).
 *
 * Devuelve una función de desuscripción.
 */
export function subscribeDocumentChanges(handler: () => void): Unsubscription {
  const wrapped = () => handler()
  Office.context.document.addHandlerAsync(DOCUMENT_CHANGED_EVENT, wrapped, (asyncResult: Office.AsyncResult<void>) => {
    if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) {
      // Si el evento no está disponible, el asistente cae a polling.
      console.warn('[WordAPA7] DocumentChanged no disponible, usando polling.', asyncResult.error)
    }
  })
  return () => {
    try {
      Office.context.document.removeHandlerAsync(DOCUMENT_CHANGED_EVENT, { handler: wrapped })
    } catch {
      /* ignore */
    }
  }
}

/**
 * Se suscribe al evento DocumentSelectionChanged (cambio de cursor/selección).
 */
export function subscribeSelectionChanges(handler: () => void): Unsubscription {
  const eventType = Office.EventType.DocumentSelectionChanged
  const wrapped = () => handler()
  Office.context.document.addHandlerAsync(eventType, wrapped)
  return () => {
    try {
      Office.context.document.removeHandlerAsync(eventType, { handler: wrapped })
    } catch {
      /* ignore */
    }
  }
}

// ── UTILIDADES ───────────────────────────────────────────────────────────────

/** Convierte un File a base64 SIN el prefijo data: (requerido por Office.js). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // quitar el prefijo "data:image/png;base64,"
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'))
    reader.readAsDataURL(file)
  })
}
