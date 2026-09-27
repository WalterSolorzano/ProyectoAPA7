/* WordAPA7 — review: la lista de hallazgos, como función pura.
   Vive FUERA del hook a propósito: `useReviewWorkbench` la usa para pintar el
   workbench y el rail la usa para CONTAR lo que le falta al usuario. Cuando las
   dos cosas eran la misma línea de un hook, el rail solo podía contar
   ortografía y citas fantasma mientras la pantalla abría cinco motores más, y
   el rail llegaba a Revisión & IA con un punto verde y la palabra "Listo".

   Reglas que este módulo no negocia (las mismas que las del hook):
   1. El detector de IA es PROBABILÍSTICO: un ítem de IA propone, la persona
      decide. Aquí solo se declara; ninguna función de este archivo escribe.
   2. Un hallazgo que no se conoce NO se descarta: cae bajo
      "Otro hallazgo del corrector" (`PROOFREAD_SPECS` tiene fila para lo
      declarado y una que recoge lo nuevo).
   3. La página es un dato de la VISTA, no del hallazgo: quien no pagina
      (el rail) pasa un `pageOf` que no existe y recibe `null`. Lo que define
      si algo es un hallazgo es esto, no dónde cae. */

import type { ElementModel, ProofreadFinding } from '../types';

export type EngineId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditItem {
  id: string;
  element_id: string;
  category: EngineId;
  /** Subtipo para agrupar: una fila por subtipo, no una por aparición */
  subtype: string;
  severity: Severity;
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  /** Página REAL del elemento, o `null` si no está en el índice */
  pageNumber: number | null;
  aiScore?: number;
  /**
   * Fase a la que pertenece el hallazgo, o `null` si es una regla general.
   * Los H1 son las fases del documento (spec D1), así que esto no es una
   * categoría del motor: es dónde está el elemento dentro del documento.
   */
  phase: string | null;
  /**
   * El hallazgo se informa pero no se puede aplicar (portada). `AGENTS.md` §1
   * dice que la portada original no se muta, así que no hay nada que aceptar.
   */
  readOnly: boolean;
}

/* "Fase" — el vocabulario del backend (`python/modules/phase_scope.py`).
   Vive ACÁ y no en un fetch aparte porque la fase es dato de la VISTA, como la
   página: el workbench y la tira la nombran, y derivarla en dos lugares es
   como un día el rail y la pantalla dejan de contar lo mismo.

   El orden es el del DOCUMENTO, no alfabético: el usuario lee de arriba hacia
   abajo, y ordenar alfabético le desordena la tesis. La portada va primera
   porque es lo primero que se ve, y referencias y anexos al final porque así
   terminan. */
export const PHASE_ORDER = [
  'portada',
  'resumen',
  'introduccion',
  'marco_teorico',
  'objetivos',
  'metodo',
  'resultados',
  'discusion',
  'conclusiones',
  'referencias',
  'anexos',
] as const;

export const PHASE_LABELS: Record<string, string> = {
  portada: 'Portada',
  resumen: 'Resumen',
  introduccion: 'Introduccion',
  marco_teorico: 'Marco teorico',
  objetivos: 'Objetivos',
  metodo: 'Metodo',
  resultados: 'Resultados',
  discusion: 'Discusion',
  conclusiones: 'Conclusiones',
  referencias: 'Referencias',
  anexos: 'Anexos',
  sin_fase: 'Seccion sin nombre',
};

/**
 * `null` = el hallazgo es de una regla general, que no pertenece a ninguna
 * fase. Una clave desconocida NO se inventa: sale como sección sin nombre.
 */
export function phaseLabel(key: string | null): string {
  if (key === null) return 'Todo el documento';
  return PHASE_LABELS[key] ?? 'Seccion sin nombre';
}

/** `'global'` y `undefined` significan lo mismo: regla general, sin fase. */
function faseDeHallazgo(f: ProofreadFinding): string | null {
  if (!f.phase || f.phase === 'global') return null;
  return f.phase;
}

/* ── Hallazgos del proofreador local ──────────────────────────────────────
   Una fila por `kind`, y la fila es TOTAL: `ProofreadFinding['kind']` es
   `'ortografia' | ... | string`, así que el tipo admite kinds que todavía no
   existen. Un hallazgo que este archivo no conoce NO se descarta: se muestra
   bajo "Otro hallazgo del corrector". Antes se descartaba en silencio, y el
   store ya lo publicaba en el mapa de transparencia (`auditSlice` KIND_LABELS
   → localStorage + StorageEvent): el usuario leía en el lienzo un aviso que
   el panel de Revisión no tenía. Un panel que calla un hallazgo que el lienzo
   enseña rompe la sincronización que AGENTS.md §2 exige entre los dos
   canales. */
export interface ProofreadSource {
  excerpt?: string;
  message: string;
}

interface ProofreadRow {
  category: EngineId;
  subtype: string;
  severity: Severity;
  summary: string;
  suggestedText?: string;
}

interface ProofreadSpec {
  category: EngineId;
  subtype: string;
  severity: Severity;
  /** Texto fijo de la fila, o el mensaje del motor si este ya lo explica. */
  summary: string | ((f: ProofreadSource) => string);
  suggestedText?: string;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/* ── La IDENTIDAD de un hallazgo ───────────────────────────────────────────
   `AuditItem.id` no es una etiqueta: es la clave de React del detalle, la que
   filtra `dismissedIds` y la que anota `markedIds`. Con un id POSICIONAL
   (`proact_${element_id}_${idx}`) las tres se rompen en cuanto la lista se
   mueve, y la lista se mueve: una segunda corrida del motor devuelve los
   mismos hallazgos en otro orden, resolver una cita fantasma la corre un
   puesto, y abrir otro documento repite las posiciones. El descarte que la
   persona acaba de hacer se queda apuntando al hallazgo que ocupa ese lugar, y
   el hallazgo de al lado desaparece de la cola sin que nada lo diga.

   La clave es CONTENIDO, y el contenido es lo que no cambia entre corridas:
   el elemento y el tipo para el corrector, el elemento para el revisor, el
   texto citado (con su elemento, porque la misma cita en dos párrafos son dos
   apariciones) para las fantasma, y la referencia entera para las huérfanas. El
   `element_id` va dentro a propósito, no por adorno: sin él, dos apariciones de
   la misma cita en el mismo documento —el caso normal en una tesis— se
   fundirían en un hallazgo, y descartar una se llevaría la otra.

   El último recurso es un índice, y por eso `collectAuditItems` lo usa SOLO
   para desempatar dos hallazgos que de verdad son indistinguibles (el mismo
   elemento, tipo y rango: el mismo hallazgo reportado dos veces). Al ser un
   desempate y no la identidad, cambiar la lista no lo mueve. */
const clave = (...partes: Array<string | number | undefined | null>): string =>
  partes
    .map((p) => (p == null ? '' : String(p)))
    .join('_')
    // Un id es una clave de React y un valor de un `Set`: los separadores que
    // vienen del contenido no pueden reescribir la separación del id.
    .replace(/\s+/g, ' ')
    .trim();

const DEL_MOTOR = (f: ProofreadSource) => clip(f.message, 70);

const PROOFREAD_SPECS: Record<string, ProofreadSpec> = {
  // Ortografía y pegado: la corrección es mecánica (objetivos, 'accept').
  ortografia: {
    category: 'spelling',
    subtype: 'ortografia',
    severity: 'high',
    summary: (f) => `Falta ortográfica o tilde: ${f.excerpt ?? ''}`,
  },
  pegado: {
    category: 'spelling',
    subtype: 'texto_pegado',
    severity: 'medium',
    summary: 'Texto pegado sin espaciado correcto',
  },

  // Redacción y Bloom.
  first_person: {
    category: 'style',
    subtype: 'primera_persona',
    severity: 'medium',
    summary: 'Uso de primera persona gramatical',
  },
  persona: {
    category: 'style',
    subtype: 'mezcla_personas',
    severity: 'medium',
    summary: DEL_MOTOR,
  },
  bloom_vague: {
    category: 'style',
    subtype: 'verbo_bloom',
    severity: 'high',
    summary: 'Verbo impreciso en objetivo académico',
    suggestedText: 'Determinar y analizar de forma rigurosa',
  },
  bloom_low: {
    category: 'style',
    subtype: 'verbo_bloom',
    severity: 'high',
    summary: 'Nivel de Bloom por debajo del objetivo del trabajo',
    suggestedText: 'Determinar y analizar de forma rigurosa',
  },

  // Lo que el detector probabilístico señala: se marca, nunca se aplica.
  ai_phrase: { category: 'ai', subtype: 'frase_ia', severity: 'medium', summary: DEL_MOTOR },
  muletilla: { category: 'ai', subtype: 'muletilla', severity: 'medium', summary: DEL_MOTOR },
  ngram_repetition: { category: 'ai', subtype: 'repeticion', severity: 'medium', summary: DEL_MOTOR },

  /* Detectados con certeza, pero sin corrección automática posible: cuál de
     las tres repeticiones se corta, a qué antecedente apunta "esto", dónde
     partir una oración de 60 palabras, qué idea falta al final. Todos 'mark'
     (la severidad espeja la que emite el auditor: incomplete → 'error',
     long_sentence → 'warn', el resto → 'info'). */
  repeticion: { category: 'style', subtype: 'palabra_repetida', severity: 'low', summary: DEL_MOTOR },
  ambigua: { category: 'style', subtype: 'pronombre_ambiguo', severity: 'low', summary: DEL_MOTOR },
  passive_voice: { category: 'style', subtype: 'voz_pasiva', severity: 'low', summary: DEL_MOTOR },
  long_sentence: { category: 'style', subtype: 'oracion_larga', severity: 'medium', summary: DEL_MOTOR },
  incompleta: { category: 'style', subtype: 'idea_incompleta', severity: 'high', summary: DEL_MOTOR },

  /* Los criterios DE FASE. Sin fila propia caían todos en `otro` —"Otro
     hallazgo del corrector"—, con el `kind` crudo en el mapa de transparencia
     del lienzo (`portada_punto_final` literal en el chip). El subtipo es la
     tercera agrupación de la vista: fase → motor → subtipo. */
  paragraph_words: { category: 'style', subtype: 'largo_parrafo', severity: 'low', summary: DEL_MOTOR },
  verbo_pasado: { category: 'style', subtype: 'tiempo_verbal', severity: 'low', summary: DEL_MOTOR },
  parafrasis_vs_cita: { category: 'style', subtype: 'parafraisis', severity: 'low', summary: DEL_MOTOR },
  /* Los dos de portada son de SOLO LECTURA: sin `suggestedText` y con subtipo
     `portada`, que `SUBTYPE_ACTION` manda a 'mark'. Que un hallazgo se informe
     y no se pueda aplicar es la invariante D6, y el subtipo la hace cumplir en
     la vista sin depender del `readOnly` que ya viaja. */
  portada_title_larga: { category: 'structure', subtype: 'portada', severity: 'low', summary: DEL_MOTOR },
  portada_punto_final: { category: 'structure', subtype: 'portada', severity: 'low', summary: DEL_MOTOR },
};

/** Todo kind tiene fila: la tabla cubre los declarados y la última recoge lo
 *  que llegue nuevo. Nunca devuelve `null`: no hay kinds que se pierdan. */
export function proofreadRow(kind: string, f: ProofreadSource): ProofreadRow {
  const spec = PROOFREAD_SPECS[kind] ?? {
    category: 'style' as EngineId,
    subtype: 'otro',
    severity: 'low' as Severity,
    summary: DEL_MOTOR,
  };
  return {
    category: spec.category,
    subtype: spec.subtype,
    severity: spec.severity,
    summary: typeof spec.summary === 'function' ? spec.summary(f) : spec.summary,
    suggestedText: spec.suggestedText,
  };
}

/** Párrafo con probabilidad alta o categoría MEDIA+: el umbral que usa la
 *  pantalla. "Alta" es 45, no 50: el mismo número que ella, escrito una vez. */
export const AI_PARAGRAPH_THRESHOLD = 45;

export interface AIReviewParagraph {
  element_id?: string;
  text?: string;
  ai_score?: number;
  ai_category?: string;
}

export interface AuditSources {
  elements: readonly ElementModel[];
  reviewResult: { paragraphs?: AIReviewParagraph[] } | null;
  proofreadFindings: readonly ProofreadFinding[];
  citationAuditResult: {
    ghost_citations?: unknown[];
    orphan_references?: unknown[];
  } | null;
}

/**
 * TODOS los hallazgos del documento, en el orden en que los produce cada motor.
 *
 * `pageOf` es opcional a propósito: el rail solo necesita el CUÁNTO, y para eso
 * la página no existe. Lo que no es opcional es la lista: si el rail y la
 * pantalla dejaran de compartir esta función, el rail volvería a prometer
 * trabajo que la pantalla no muestra.
 */
export function collectAuditItems(
  sources: AuditSources,
  pageOf?: (elementId: string) => number | null,
): AuditItem[] {
  const { elements, reviewResult, proofreadFindings, citationAuditResult } = sources;
  const out: AuditItem[] = [];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const page = pageOf ?? (() => null);

  /* Dos ids iguales en la MISMA lista serían dos filas con la misma clave de
     React y un descarte compartido: una borra las dos. Ningún motor debería
     producirlos —la clave ya incluye todo lo que distingue un hallazgo de
     otro—, así que esto es una red, no la identidad: si un backend futuro
     duplica un hallazgo, se le da un sufijo y las dos filas siguen siendo
     distinguibles. El sufijo cuenta REPETICIONES de la misma clave, no
     posiciones: la lista puede reordenarse sin que el id se mueva. */
  const vistos = new Set<string>();
  const registrar = (base: string): string => {
    let id = base;
    for (let n = 2; vistos.has(id); n += 1) id = `${base}_${n}`;
    vistos.add(id);
    return id;
  };

  // 1. Detector de IA: párrafos con probabilidad alta o categoría MEDIA+.
  for (const [idx, p] of (reviewResult?.paragraphs || []).entries()) {
    const score = p.ai_score || 0;
    if (!(score >= AI_PARAGRAPH_THRESHOLD || p.ai_category === 'HIGH' || p.ai_category === 'MEDIUM')) continue;
    // `ai_score` ausente o cero no es un 60% ni un 50%: es "no medido". Un
    // párrafo puede entrar por `ai_category` con la puntuación sin calcular,
    // y mostrarle un número al usuario sería inventarlo.
    const medido = score > 0;
    out.push({
      // El elemento es la identidad del párrafo. Solo se recurre al índice
      // cuando el revisor no lo trajo: sin él no hay nada estable, y un id
      // ausente fundiría todos esos párrafos en un hallazgo.
      id: registrar(clave('ai_rev', p.element_id || `origen_${idx}`)),
      element_id: p.element_id || '',
      category: 'ai',
      subtype: 'parrafo_ia',
      severity: score >= 70 ? 'high' : 'medium',
      summary: medido
        ? `Índice de IA ${score}% — rigidez sintética detectada`
        : 'Índice de IA alto — rigidez sintética detectada',
      detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
      originalText: (p.element_id ? byId.get(p.element_id)?.text : '') || p.text || '',
      suggestedText: undefined,
      pageNumber: p.element_id ? page(p.element_id) : null,
      aiScore: medido ? score / 100 : undefined,
      // Los motores que no conocen la fase la declaran nula: son reglas
      // generales y no pertenecen a ninguna (spec D2). 
      phase: null,
      readOnly: false,
    });
  }

  // 2. Hallazgos proactivos locales: TODOS los `kind` que emite el auditor.
  for (const f of proofreadFindings ?? []) {
    const row = proofreadRow(String(f.kind), f);
    out.push({
      // Elemento + tipo + rango: el tipo porque dos auditores señalan el mismo
      // tramo por motivos distintos, y el rango porque `palabra_repetida`
      // señala la misma palabra en cada repetición. El índice de la lista no
      // entra: cambiar el orden de los motors no cambia qué es qué hallazgo.
      id: registrar(clave('proact', f.element_id, String(f.kind), f.start, f.end)),
      element_id: f.element_id,
      category: row.category,
      subtype: row.subtype,
      severity: row.severity,
      summary: row.summary,
      detail: f.message,
      originalText: (f.element_id ? byId.get(f.element_id)?.text : '') || f.excerpt || '',
      // Un hallazgo de solo lectura nunca trae sugerencia (invariante del
      // motor, `modules/finding.py`), y aquí tampoco se inventa una: no hay
      // nada que la aplicadora pueda escribir sobre la portada.
      suggestedText: f.read_only ? undefined : f.suggestion || row.suggestedText,
      pageNumber: f.element_id ? page(f.element_id) : null,
      phase: faseDeHallazgo(f),
      readOnly: f.read_only === true,
    });
  }

  // 3. Citas fantasma (aparecen en el texto, no en la bibliografía).
  for (const ghost of citationAuditResult?.ghost_citations || []) {
    const g = ghost as {
      element_id?: string;
      citation_text?: string;
      raw_text?: string;
    };
    const texto = g.citation_text || g.raw_text || 'Desconocida';
    out.push({
      // Elemento + texto citado: el elemento porque la misma referencia citada
      // en dos párrafos son dos apariciones que se resuelven por separado.
      id: registrar(clave('ghost_cite', g.element_id, texto)),
      element_id: g.element_id || '',
      category: 'citations',
      subtype: 'cita_fantasma',
      severity: 'critical',
      summary: `Cita "${texto}" ausente en bibliografía`,
      detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
      originalText: g.citation_text || '',
      pageNumber: g.element_id ? page(g.element_id) : null,
      // Los motores que no conocen la fase la declaran nula: son reglas
      // generales y no pertenecen a ninguna (spec D2). 
      phase: null,
      readOnly: false,
    });
  }

  // 4. Referencias huérfanas (en la bibliografía, nunca citadas).
  for (const orphan of citationAuditResult?.orphan_references || []) {
    const o = orphan as { authors?: string[]; year?: string | number; raw_text?: string };
    out.push({
      // Sin elemento al que anclarse, la identidad es la referencia entera. La
      // cruda manda porque distingue dos entradas del mismo autor y año; los
      // autores y el año están detrás por si el backend no la manda.
      id: registrar(clave('orphan_ref', o.raw_text || '', (o.authors || []).join(' '), o.year)),
      element_id: '',
      category: 'citations',
      subtype: 'referencia_huerfana',
      severity: 'medium',
      summary: `Referencia "${o.authors?.[0] || 'Autor'} (${o.year || 's.f.'})" no citada en texto`,
      detail: 'Consta en la bibliografía final pero ninguna sección del documento la referencia expresamente.',
      originalText: o.raw_text || '',
      // Sin elemento que anclar: una referencia huérfana vive en la lista
      // final, y la lista no tiene página. `null` antes que la página del
      // último elemento (que era la estimación que se reemplaza aquí).
      pageNumber: null,
      // Los motores que no conocen la fase la declaran nula: son reglas
      // generales y no pertenecen a ninguna (spec D2).
      phase: null,
      readOnly: false,
    });
  }

  // 5. Estructura y rotulación APA 7.
  for (const e of elements) {
    if (e.type === 'heading' && e.needs_review) {
      out.push({
        id: registrar(`struct_head_${e.id}`),
        element_id: e.id,
        category: 'structure',
        subtype: 'encabezado',
        severity: 'medium',
        summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
        detail: 'Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).',
        originalText: e.text || '',
        pageNumber: page(e.id),
        phase: null,
        readOnly: false,
      });
    } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
      out.push({
        id: registrar(`struct_fig_${e.id}`),
        element_id: e.id,
        category: 'structure',
        subtype: 'figura',
        severity: 'high',
        summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
        detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
        originalText: '[Figura sin rotular]',
        suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
        pageNumber: page(e.id),
        phase: null,
        readOnly: false,
      });
    } else if (e.type === 'table' && !e.table_info?.caption) {
      out.push({
        id: registrar(`struct_tbl_${e.id}`),
        element_id: e.id,
        category: 'structure',
        subtype: 'tabla',
        severity: 'high',
        summary: 'Tabla sin rotulación reglamentaria APA 7',
        detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
        originalText: '[Tabla sin rotular]',
        suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
        pageNumber: page(e.id),
        phase: null,
        readOnly: false,
      });
    }
  }

  return out;
}
