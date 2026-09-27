/* WordAPA7 — review: capa de datos del workbench.
   Todo lo que antes eran 20 useState y 300 líneas de memos dentro del
   componente. Sin JSX, para poder probar el filtrado, el agrupado, la
   paginación real y la honestidad de las métricas sin DOM.

   Tres reglas que este módulo no negocia:
   1. El detector de IA es PROBABILÍSTICO: propone, la persona decide. Ninguna
      ruta de este archivo aplica una sugerencia suya (ver `aceptaDeIA`), ni
      aunque la vista llame a `runGroupAction` con el grupo entero.
   2. Un motor que no ha corrido no produce números: `compliance` es `null`
      hasta que los tres motores dejaron resultados, y un motor que falló en
      esta sesión vuelve a `null` (ver `lastRunState`).
   3. Las páginas salen de `usePageIndex` (la paginación real del lienzo). Un
      elemento que no está en el índice devuelve `null`, nunca un número
      estimado: la heurística de 1800 caracteres por página que convivía con
      esta fuente murió con `Step5AuditIAWizard`, que ahora es un envoltorio de
      `ReviewWorkbench`. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useDocStore } from '../store/useDocStore';
import { usePageIndex } from './usePageIndex';
import type { MinimapMark } from '../components/wizard/ReviewMinimap';
import {
  summarizeScanOutcomes,
  toReason,
  type EngineScanOutcome,
  type ScanEngineId,
} from '../components/wizard/scanOutcome';
import * as api from '../api/backend';
import { collectAuditItems, type AuditItem, type EngineId, type Severity } from '../lib/auditItems';

/* La LISTA de hallazgos vive en `lib/auditItems` porque el rail necesita contar
   la misma que esta vista abre. Estos `export type` siguen siendo su puerta:
   media app importa `AuditItem` desde acá y no tiene por qué saber dónde se
   escribieron los tipos. */
export type { AuditItem, EngineId, Severity };
export type EngineFilter = EngineId | 'all';
export type SubtypeAction = 'accept' | 'mark' | 'resolveGhosts' | 'autoCaption' | 'none';

export interface SubtypeGroup {
  key: string;
  label: string;
  items: AuditItem[];
  action: SubtypeAction;
  massLabel: string;
}

export interface EngineGroup {
  engine: EngineId;
  title: string;
  chip: string;
  count: number;
  criticalHigh: number;
  groups: SubtypeGroup[];
  massAction: SubtypeAction;
  massLabel: string;
  /**
   * Las dos mitades de "hasta dónde llega la acción en masa", publicadas JUNTO
   * con `massAction` porque las dos las produce la misma regla: la cabecera
   * actúa solo sobre los subtipos que comparten su acción (ver
   * `runGroupAction`). `covered` = hallazgos de esos subtipos, `count` = los
   * del motor entero. Con las dos mitades a la vista, quien pinta el aviso no
   * puede equivocarse: si la vista las re-derivara por su cuenta, un cambio de
   * alcance en el hook dejaría el número del rack diciendo una cosa y el aviso
   * de cobertura otra, y la que se ve es la que miente.
   */
  covered: number;
}

export interface ReviewWorkbenchApi {
  /** Hallazgos no descartados, en el orden en que los produjo cada motor */
  items: AuditItem[];
  /** Grupos de lo que el FILTRO deja ver: el rack de acciones y la semilla de
   *  `openEngines` los quieren estrechos. NO los confundas con `allGroups`. */
  groups: EngineGroup[];
  /** Un grupo por motor sobre TODOS los hallazgos, sin filtro. Es lo que
   *  necesitan los chips de la barra: un chip por motor que se pierde cuando
   *  hay un filtro activo no deja volver a "Todo" ni elegir otro motor. */
  allGroups: EngineGroup[];
  /** `items.length > 0`: hay hallazgos en el documento, filtrados o no. Derivarlo
   *  de `groups` haría que un filtro dejara la barra pensando que no hay nada. */
  hasFindings: boolean;
  /** Cuántos hallazgos deja ver el FILTRO ACTIVO, que es el conjunto exacto
   *  que recorre `nextFinding`. La vista lo necesita para no dejar "Siguiente
   *  hallazgo" encendido cuando el filtro se queda sin destino, y no lo
   *  re-deriva: el predicado del filtro es de acá, no de quien lo mira. */
  visibleCount: number;
  /** Una marca por página con hallazgo: color = motor dominante de ESA página */
  marks: Map<number, MinimapMark>;
  /** Ids de elemento con ALGÚN hallazgo, ya recortados por el filtro. Es lo que
   *  el lienzo usa para teñir de acento los bloques con hallazgos en el modo
   *  Hoja (`reviewHighlightIds`). Sale de `visibles` y no de `items`: el
   *  conjunto que se cuenta es el mismo que `visibleCount` y el que
   *  recorre `nextFinding`. */
  highlightIds: Set<string>;
  filter: EngineFilter;
  setFilter: (f: EngineFilter) => void;
  totalPages: number;
  currentPage: number;
  goToPage: (p: number) => void;
  selected: AuditItem | null;
  select: (id: string | null) => void;
  nextFinding: () => void;
  openEngines: EngineId[];
  setOpenEngines: Dispatch<SetStateAction<EngineId[]>>;
  openSubtypes: string[];
  setOpenSubtypes: Dispatch<SetStateAction<string[]>>;
  acceptOne: (item: AuditItem) => Promise<void>;
  acceptMany: (items: AuditItem[]) => Promise<void>;
  markForReview: (item: AuditItem) => void;
  /**
   * Ejecuta la acción de un grupo (cabecera de motor o fila de subtipo). La
   * vista pinta el rótulo y llama acá: no decide qué acción hay, ni cómo se
   * hace. `'none'` no ejecuta nada y lo dice.
   */
  runGroupAction: (group: EngineGroup | SubtypeGroup) => Promise<void>;
  dismiss: (item: AuditItem) => void;
  markedIds: string[];
  scanAll: () => Promise<void>;
  isScanning: boolean;
  /** Hay una escritura al documento en curso. La UI se apaga con esto: la
   *  acción en masa es SECUENCIAL y hace una llamada de red por hallazgo, así
   *  que sin cerrojo un segundo "Aceptar todas" duplica la tanda. */
  isApplying: boolean;
  metrics: { total: number; critical: number; compliance: number | null };
  viewMode: 'focus' | 'canvas';
  setViewMode: (m: 'focus' | 'canvas') => void;
}

/** Orden de motores para grupos, chips y minimapa. El motor probabilístico
 *  va al final: es el que menos se ofrece a resolver solo. */
export const ENGINE_ORDER: EngineId[] = ['spelling', 'style', 'structure', 'citations', 'ai'];

export const ENGINE_META: Record<EngineId, { title: string; chip: string; color: string }> = {
  spelling: { title: 'Ortografía', chip: 'Ortografía', color: 'var(--color-accent)' },
  style: { title: 'Redacción & Bloom', chip: 'Redacción & Bloom', color: 'var(--color-warning)' },
  structure: { title: 'Estructura', chip: 'Estructura', color: 'var(--color-text-secondary)' },
  citations: { title: 'Citas', chip: 'Citas', color: 'var(--color-success)' },
  ai: { title: 'Patrones IA', chip: 'Patrones IA', color: 'var(--color-danger)' },
};

/* Motores que corre el "Escanear" global, en el orden de Promise.allSettled.
   labels = nombre corto usado en el toast de fallo (chip de la UI). */
const SCAN_ENGINES: { id: ScanEngineId; label: string }[] = [
  { id: 'ai', label: 'IA' },
  { id: 'proofread', label: 'Ortografía' },
  { id: 'citations', label: 'Citas' },
];

/**
 * Subtipo = el `kind` del proofreador NORMALIZADO. El backend emite un
 * `kind` por hallazgo ('ai_phrase', 'bloom_vague', 'bloom_low'...); sin esta
 * capa, cada uno sería su propia fila y ninguno tendría etiqueta de usuario.
 * Toda etiqueta que `PROOFREAD_SPECS` produce tiene fila aquí Y en
 * `SUBTYPE_ACTION`: un subtipo sin acción caería en la del motor, que para IA
 * es 'mark' pero para un motor objetivo sería 'accept' sobre un hallazgo que
 * nadie ha revisado.
 */
const SUBTYPE_LABELS: Record<string, string> = {
  parrafo_ia: 'Párrafo con índice IA alto',
  frase_ia: 'Frase típica de IA',
  muletilla: 'Muletilla o repetición',
  repeticion: 'Repetición de n-gramas',
  primera_persona: 'Primera persona gramatical',
  mezcla_personas: 'Mezcla de personas gramaticales',
  verbo_bloom: 'Verbo impreciso en objetivo (Bloom)',
  ortografia: 'Falta ortográfica o tilde',
  texto_pegado: 'Texto pegado sin espaciado',
  palabra_repetida: 'Palabra repetida',
  pronombre_ambiguo: 'Pronombre ambiguo',
  voz_pasiva: 'Voz pasiva',
  oracion_larga: 'Oración extensa',
  idea_incompleta: 'Idea incompleta',
  otro: 'Otro hallazgo del corrector',
  cita_fantasma: 'Cita ausente en bibliografía',
  referencia_huerfana: 'Referencia nunca citada',
  encabezado: 'Jerarquía de encabezado',
  figura: 'Figura sin rotular',
  tabla: 'Tabla sin rotular',
};

/** Acción masiva por subtipo: qué tan objetiva es la corrección del motor. */
const SUBTYPE_ACTION: Record<string, SubtypeAction> = {
  parrafo_ia: 'mark',
  frase_ia: 'mark',
  muletilla: 'mark',
  repeticion: 'mark',
  /* Hallazgos que el motor DETECTA pero no puede corregir solo: cuáles de las
     tres repeticiones cortar, a qué antecedente se refiere "esto", cómo
     partir una oración de 60 palabras. Se marcan; no se aplican. */
  palabra_repetida: 'mark',
  pronombre_ambiguo: 'mark',
  voz_pasiva: 'mark',
  oracion_larga: 'mark',
  idea_incompleta: 'mark',
  otro: 'mark',
  primera_persona: 'accept',
  mezcla_personas: 'accept',
  verbo_bloom: 'accept',
  ortografia: 'accept',
  texto_pegado: 'accept',
  cita_fantasma: 'resolveGhosts',
  referencia_huerfana: 'none',
  encabezado: 'none',
  figura: 'autoCaption',
  tabla: 'autoCaption',
};

/**
 * Copy del botón masivo, y el UNICO lugar donde se decide.
 *
 * AGENTS.md §1 es el MARCO: los motores OBJETIVOS (ortografía, Bloom,
 * estructura, citas) ofrecen una corrección en bloque, y el motor
 * PROBABILÍSTICO (detector de IA) SOLO marca para revisar. Qué palabra usa cada
 * objetivo lo afinó T16, y lo que manda es esto:
 *
 * - "Aceptar" es la corrección OBJETIVA y POR HALLAZGO. Solo la usa la acción
 *   `accept`, la única que escribe el texto de alguien.
 * - Estructura redacta leyendas y Citas resuelve referencias ausentes: los dos
 *   mecanismos trabajan sobre TODO el documento, así que su rótulo nombra el
 *   mecanismo y su alcance ("Rotular todo el documento", "Resolver citas del
 *   documento"). Antes ambos se llamaban "Aceptar todas", lo que prometía
 *   corregir el texto de un hallazgo —que no es lo que pasa— y además
 *   contradecía al control de la aparición, en la misma tarjeta, que dice
 *   "Rotular todo" / "Resolver citas" y hace lo mismo.
 *
 * El MECANISMO lo elige `runGroupAction` (autoResolveGhosts, autoCaptionAll,
 * updateElementText); aquí vive solo la palabra.
 */
const MASS_LABELS: Record<Exclude<SubtypeAction, 'none'>, string> = {
  accept: 'Aceptar todas',
  mark: 'Marcar todos',
  resolveGhosts: 'Resolver citas del documento',
  autoCaption: 'Rotular todo el documento',
};

/** `'none'` no tiene rotulo: sin correccion que ofrecer, no hay boton. */
const massLabelFor = (action: SubtypeAction): string =>
  action === 'none' ? '' : MASS_LABELS[action];

/**
 * El ORDEN de gravedad, y con él la severidad más grave de un grupo. Es la
 * única definición en el código, y vive aquí porque el hook es quien ordena los
 * subtipos y quien decide qué motor tiñe cada página del minimapa.
 * `EngineGroupCard` la importa para el badge: dos copias de esta tabla serían
 * dos verdades, y con un nivel nuevo en el vocabulario de severidad la del
 * badge se quedaría atrás mientras el orden cambiaba, sin que nada lo dijera.
 *
 * El tipo es lo que hace que agregar un nivel NO sea un cambio silencioso: la
 * compilación falla en esta tabla y en el `Record<AuditItem['severity'], string>`
 * del color del badge, que son los dos únicos sitios donde el vocabulario se
 * escribe.
 */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Acción masiva de la cabecera de un motor. El motor probabilístico NUNCA
 *  acepta: marca. Estructura rotula, no "corrige": las leyendas las redacta
 *  `autoCaptionAll`, no una cadena inventada aquí. */
const engineAction = (engine: EngineId): SubtypeAction => {
  if (engine === 'ai') return 'mark';
  if (engine === 'citations') return 'resolveGhosts';
  if (engine === 'structure') return 'autoCaption';
  return 'accept';
};

/* ── Agrupación por motor y por subtipo ────────────────────────────────────
   Función pura y fuera del hook: la usan las DOS listas que publica la API
   (`groups`, filtrada, y `allGroups`, completa). Que sea la misma función es
   lo que garantiza que un chip por motor y una fila del rack digan el mismo
   número: si se escribieran por separado, uno de los dos mentiría. */
function agruparHallazgos(visibles: AuditItem[]): EngineGroup[] {
  const porMotor = new Map<EngineId, AuditItem[]>();
  for (const it of visibles) {
    const arr = porMotor.get(it.category);
    if (arr) arr.push(it);
    else porMotor.set(it.category, [it]);
  }
  return ENGINE_ORDER.filter((e) => porMotor.has(e)).map((engine) => {
    const propios = porMotor.get(engine)!;
    const porSubtipo = new Map<string, AuditItem[]>();
    for (const it of propios) {
      const arr = porSubtipo.get(it.subtype);
      if (arr) arr.push(it);
      else porSubtipo.set(it.subtype, [it]);
    }
    const subgrupos: SubtypeGroup[] = [...porSubtipo.entries()].map(([key, susItems]) => {
      // Sin subtipo conocido, la acción es la del motor: un motor IA jamás
      // cae en 'accept' aunque el subtipo no esté en la tabla.
      const action = SUBTYPE_ACTION[key] || engineAction(engine);
      return {
        key: `${engine}:${key}`,
        label: SUBTYPE_LABELS[key] || key,
        items: susItems,
        action,
        massLabel: massLabelFor(action),
      };
    });
    subgrupos.sort((a, b) => {
      const ra = Math.min(...a.items.map((i) => SEVERITY_RANK[i.severity]));
      const rb = Math.min(...b.items.map((i) => SEVERITY_RANK[i.severity]));
      return ra - rb || b.items.length - a.items.length;
    });
    const massAction = engineAction(engine);
    return {
      engine,
      title: ENGINE_META[engine].title,
      chip: ENGINE_META[engine].chip,
      count: propios.length,
      criticalHigh: propios.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
      groups: subgrupos,
      massAction,
      massLabel: massLabelFor(massAction),
      /* La MISMA regla que usa `runGroupAction` para decidir a quién toca,
         contada aquí: los subtipos que comparten la acción del motor. Publicar
         las dos mitades (estas y `count`) es lo que permite que la cabecera
         diga hasta dónde llega sin re-derivar nada. */
      covered: subgrupos
        .filter((g) => g.action === massAction)
        .reduce((n, g) => n + g.items.length, 0),
    };
  });
}

/** Una página dentro del rango real del documento. `totalPages` 0 (documento sin
 *  páginas) recorta a 1, no a 0: el 0 es "no hay páginas", no "la página 0". */
const clipPage = (page: number, totalPages: number): number => {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, totalPages));
};

export function useReviewWorkbench(): ReviewWorkbenchApi {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const aiIndices = useDocStore((s) => s.aiIndices);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  /* El canal de descarte del LIENZO. `dismiss` de esta vista y esta función
     tienen que ir juntos: uno saca la fila del rack, el otro la burbuja y su
     subrayado, y son el mismo hallazgo. */
  const dismissComment = useDocStore((s) => s.dismissComment);
  const runAIReview = useDocStore((s) => s.runAIReview);
  const runProofreadBatch = useDocStore((s) => s.runProofreadBatch);
  const runCitationAudit = useDocStore((s) => s.runCitationAudit);
  const autoResolveGhosts = useDocStore((s) => s.autoResolveGhosts);
  const autoCaptionAll = useDocStore((s) => s.autoCaptionAll);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const showToast = useDocStore((s) => s.showToast);

  const { totalPages, pages, pageOf } = usePageIndex();
  const [filter, setFilter] = useState<EngineFilter>('all');
  const [viewMode, setViewMode] = useState<'focus' | 'canvas'>('focus');
  const [openEngines, setOpenEngines] = useState<EngineId[]>([]);
  const [openSubtypes, setOpenSubtypes] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  /* Hay UNA acción en curso a la vez. `acceptMany` recorre los hallazgos de uno
     en uno y `aplicar` hace una llamada de red por hallazgo sin sugerencia: un
     "Aceptar todas" grande son N llamadas secuenciales, y sin este cerrojo el
     botón se puede volver a apretar mientras la primera tanda sigue corriendo.
     La segunda tanda vuelve a disparar las MISMAS llamadas sobre los MISMOS
     elementos, y el último que escribe gana de forma no determinista: el
     documento queda con una corrección arbitraria de entre las dos. El cerrojo
     no es una decoración de estado: es lo que hace la acción idempotente. */
  const [isApplying, setIsApplying] = useState(false);
  const aplicando = useRef(false);
  const seeded = useRef(false);

  /* La página actual SIEMPRE vive en el rango real del documento. Es un
     `useState` crudo, y el rango se mueve solo: una edición que fusiona
     elementos, o un documento que encoge bajo la vista, dejaban "Página 2 de
     1" y una flecha anterior que caminaba por páginas que ya no existen. */
  useEffect(() => {
    setCurrentPage((prev) => clipPage(prev, totalPages));
  }, [totalPages]);

  /* Último escaneo observado por motor (dentro de esta vista): guarda los
     resultados de store en el momento de correr. Si los refs no cambiaron,
     ese sigue siendo el último resultado (éxito o fallo); si cambiaron, un
     éxito posterior — desde cualquier vista — limpia el fallo registrado. */
  const lastScanRef = useRef<Partial<Record<ScanEngineId, { ok: boolean; snap: unknown }>>>({});

  const elements = useMemo(() => doc?.elements || [], [doc]);

  /* La lista la construye `lib/auditItems` — la MISMA función que cuenta el
     rail: lo que esta vista abre y lo que el rail promete tienen que ser el
     mismo conjunto, o el punto verde de Revisión & IA miente. `pageOf` es lo
     único que esta vista le aporta. Los descartes (`dismissedIds`) son estado
     de la vista, así que se aplican acá y no en el módulo compartido. */
  const items = useMemo<AuditItem[]>(
    () => collectAuditItems(
      { elements, reviewResult, proofreadFindings, citationAuditResult },
      pageOf,
    ).filter((it) => !dismissedIds.includes(it.id)),
    [reviewResult, proofreadFindings, citationAuditResult, elements, dismissedIds, pageOf],
  );

  /* El resumen COMPLETO, sin filtro: es lo que pinta los chips. El conjunto
     estrecho sale de aquí, no al revés, para que los dos coincidan siempre. */
  const allGroups = useMemo(() => agruparHallazgos(items), [items]);

  /* Lo que el FILTRO deja ver, en una sola expresión. La usan los grupos
     estrechos, `nextFinding` y el `visibleCount` que la vista usa para no
     dejar "Siguiente hallazgo" encendido sin destino: si el predicado estuviera
     escrito en la vista también, cambiarlo aquí encendería el botón y lo
     dejaría inerte, que es el defecto que esta cuenta existe para evitar. */
  const visibles = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  const groups = useMemo(
    () => (filter === 'all' ? allGroups : agruparHallazgos(visibles)),
    [allGroups, visibles],
  );

  /* Los bloques con hallazgo, en el mismo conjunto que cuenta `visibleCount`. */
  const highlightIds = useMemo(
    () => new Set(visibles.map((i) => i.element_id).filter(Boolean)),
    [visibles],
  );

  /* La siembra es POR DOCUMENTO, y el documento se identifica por su sesión,
     no por la identidad del objeto: `updateElementText` (aceptar una
     corrección) reemplaza el `doc` entero en el store, así que con `[doc]`
     cada corrección aceptada borraba la siembra y el panel volvía a
     desplegarse solo, tirándose abajo lo que la persona acababa de abrir.
     Un documento nuevo es otra `session_id` (las pestañas del Explorador de
     Proyecto son sesiones distintas), así que reiniciar por `session_id`
     conserva el comportamiento de "otro documento, otros grupos" sin el
     efecto colateral. */
  const sessionId = doc?.session_id;
  useEffect(() => {
    seeded.current = false;
    /* Los descartes y las marcas SON de un documento. Un id de hallazgo es
       estable dentro de una sesión (id de elemento + tipo + rango, el texto
       citado, la referencia), así que sobreviven a un reescaneo del MISMO
       documento —que es lo que deben hacer— pero no tienen nada que ver con los
       hallazgos de otro: sin este reinicio, abrir una segunda tesis cuyos
       hallazgos caen sobre las mismas claves escondía los suyos detrás de
       descartes que la persona nunca hizo aquí. La lista de findings y la de
       descartes son del MISMO documento o no son nada. */
    setDismissedIds([]);
    setMarkedIds([]);
  }, [sessionId]);

  /* Solo el grupo más crítico abre por defecto, una vez por sesión de datos. */
  useEffect(() => {
    if (seeded.current || !groups.length) return;
    seeded.current = true;
    const masCritico = [...groups].sort(
      (a, b) => b.criticalHigh - a.criticalHigh || b.count - a.count,
    )[0];
    if (masCritico) setOpenEngines([masCritico.engine]);
  }, [groups]);

  const marks = useMemo(() => {
    const porPagina = new Map<number, { motores: EngineId[]; count: number; peor: Map<EngineId, number> }>();
    for (const it of items) {
      if (it.pageNumber == null) continue;
      if (filter !== 'all' && it.category !== filter) continue;
      let v = porPagina.get(it.pageNumber);
      if (!v) {
        v = { motores: [], count: 0, peor: new Map() };
        porPagina.set(it.pageNumber, v);
      }
      if (!v.motores.includes(it.category)) v.motores.push(it.category);
      v.count += 1;
      v.peor.set(it.category, Math.min(v.peor.get(it.category) ?? 99, SEVERITY_RANK[it.severity]));
    }
    const salida = new Map<number, MinimapMark>();
    for (const [pagina, v] of porPagina) {
      // La marca de la página la tiñe el motor más grave de ESA página, no el
      // primero que aparezca.
      const dominante = [...v.motores].sort((a, b) => (v.peor.get(a) ?? 99) - (v.peor.get(b) ?? 99))[0];
      salida.set(pagina, {
        color: ENGINE_META[dominante].color,
        count: v.count,
        label: ENGINE_META[dominante].title,
      });
    }
    return salida;
  }, [items, filter]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const item = items.find((i) => i.id === id);
      if (item?.element_id) {
        setSelectedElementId(item.element_id);
        setScrollTargetId(item.element_id);
      }
    },
    [items, setSelectedElementId, setScrollTargetId],
  );

  const goToPage = useCallback(
    (page: number) => {
      // "Página X de N" se lee de `currentPage`: sin recorte, un clic fuera de
      // rango dejaría la lectura apuntando a una hoja que no existe.
      const destino = clipPage(page, totalPages);
      const el = pages[destino - 1]?.find((e) => e?.id && e.type !== 'page_break');
      if (el) {
        setSelectedElementId(el.id);
        setScrollTargetId(el.id);
      }
      setCurrentPage(destino);
    },
    [pages, totalPages, setSelectedElementId, setScrollTargetId],
  );

  const nextFinding = useCallback(() => {
    // "Siguiente hallazgo" recorre lo que el filtro deja ver: saltar a un
    // hallazgo de un motor apagado sería aterrizar fuera de la lista. Es el
    // MISMO conjunto que cuenta `visibleCount`.
    if (!visibles.length) return;
    const ordenada = [...visibles].sort((a, b) => (a.pageNumber ?? 999) - (b.pageNumber ?? 999));
    const i = ordenada.findIndex((x) => x.id === selectedId);
    const siguiente = ordenada[(i + 1) % ordenada.length];
    setOpenEngines((prev) => (prev.includes(siguiente.category) ? prev : [...prev, siguiente.category]));
    const subkey = `${siguiente.category}:${siguiente.subtype}`;
    setOpenSubtypes((prev) => (prev.includes(subkey) ? prev : [...prev, subkey]));
    select(siguiente.id);
    // `pageOf` solo devuelve páginas del índice, así que el recorte no cambia
    // el resultado HOY: es la misma defensa que aplica `goToPage`, puesta aquí
    // para que ningún camino que salta de página quede sin recortar.
    if (siguiente.pageNumber) setCurrentPage(clipPage(siguiente.pageNumber, totalPages));
  }, [visibles, selectedId, select, totalPages]);

  /** El motor probabilístico no aplica nada: sus hallazgos no se aceptan. */
  const aceptaDeIA = (item: AuditItem) => item.category !== 'ai';

  /** Aplica la corrección de un hallazgo objetivo. `false` = el texto original
   *  sigue intacto y el hallazgo sigue en la lista. */
  const aplicar = useCallback(
    async (item: AuditItem): Promise<boolean> => {
      if (!aceptaDeIA(item) || !doc || !item.element_id) return false;
      try {
        if (item.suggestedText) {
          await updateElementText(item.element_id, item.suggestedText);
        } else {
          const reescrito = await api.rewriteText(
            doc.session_id,
            item.element_id,
            item.originalText,
            'Reescribir en voz formal impersonal académica según APA 7, eliminando rigidez y muletillas',
          );
          if (!reescrito) {
            showToast('No se pudo generar la corrección. El texto original se conserva.', 'error');
            return false;
          }
          await updateElementText(item.element_id, reescrito);
        }
        setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
        setSelectedId((prev) => (prev === item.id ? null : prev));
        showToast('Corrección aplicada al documento', 'success');
        return true;
      } catch {
        showToast('Error al aplicar la sugerencia', 'error');
        return false;
      }
    },
    [doc, updateElementText, showToast],
  );

  const acceptOne = useCallback(
    async (item: AuditItem) => {
      if (!aceptaDeIA(item)) {
        showToast('El detector de IA propone, no aplica: márcalo para revisión manual.');
        return;
      }
      /* Mismo cerrojo que la tanda: aceptar uno y aceptar todos son la misma
         escritura sobre el documento. */
      if (aplicando.current) return;
      aplicando.current = true;
      setIsApplying(true);
      try {
        await aplicar(item);
      } finally {
        aplicando.current = false;
        setIsApplying(false);
      }
    },
    [aplicar, showToast],
  );

  const acceptMany = useCallback(
    async (lista: AuditItem[]) => {
      const targets = lista.filter((i) => i.element_id && aceptaDeIA(i));
      if (!targets.length) return;
      /* El ref, no el estado: dos pulsaciones en el mismo tick de React leen
         el mismo `isApplying` del render anterior, y con estado las dos
         entrarían. El ref se escribe en el momento de la llamada. */
      if (aplicando.current) return;
      aplicando.current = true;
      setIsApplying(true);
      let ok = 0;
      try {
        for (const it of targets) {
          if (await aplicar(it)) ok += 1;
        }
      } finally {
        aplicando.current = false;
        setIsApplying(false);
      }
      if (ok > 0) showToast(`${ok} corrección(es) aplicada(s)`, 'success');
      else showToast('No se pudieron aplicar las correcciones', 'error');
    },
    [aplicar, showToast],
  );

  const markMany = useCallback(
    (lista: AuditItem[]) => {
      if (!lista.length) return;
      setMarkedIds((prev) => [...new Set([...prev, ...lista.map((i) => i.id)])]);
      showToast(
        lista.length === 1
          ? 'Marcado para revisar. El texto original no se modifica.'
          : `${lista.length} hallazgos marcados para revisar. El texto original no se modifica.`,
        'info',
      );
    },
    [showToast],
  );

  const markForReview = useCallback((item: AuditItem) => markMany([item]), [markMany]);

  /** Una acción, sobre los ítems que esa acción cubre. */
  const despachar = useCallback(
    async (action: SubtypeAction, objetivos: AuditItem[]) => {
      switch (action) {
        case 'accept':
          await acceptMany(objetivos);
          return;
        case 'mark':
          markMany(objetivos);
          return;
        case 'resolveGhosts':
          await autoResolveGhosts();
          return;
        case 'autoCaption':
          await autoCaptionAll();
          return;
        case 'none':
          // Sin corrección objetiva no hay nada que ejecutar: se dice, para que
          // el silencio no se lea como "se aplicó y no pasó nada".
          showToast('Este hallazgo no tiene corrección automática: revísalo o descártalo.', 'info');
          return;
      }
    },
    [acceptMany, markMany, autoResolveGhosts, autoCaptionAll, showToast],
  );

  /**
   * La vista NO ejecuta acciones: pregunta. Este hook es la única autoridad
   * sobre qué acción tiene un grupo (su `action`/`massAction`) y sobre cómo se
   * ejecuta, así que la vista no tiene que volver al store para resolver
   * citas fantasma ni rotular figuras, ni adivinar qué hacer con 'none'.
   * Acepta un `EngineGroup` (cabecera de motor) o un `SubtypeGroup` (fila).
   *
   * LA REGLA, en una línea: **la cabecera de un motor actúa solo sobre los
   * subtipos que comparten su acción.** Un subtipo que discrepa no se toca.
   *
   * Sin esa regla, el botón "Aceptar todas" de Redacción & Bloom se llevaba
   * también `palabra_repetida`, `pronombre_ambiguo`, `voz_pasiva`,
   * `oracion_larga`, `idea_incompleta` y el fallback `otro`: subtipos a los que
   * el propio hook les asignó 'mark' porque el motor los detecta con certeza
   * pero no sabe corregirlos. `aplicar` los habría mandado a
   * `api.rewriteText` y escrito prosa generada en el documento del usuario,
   * una llamada de red por hallazgo. Lo mismo con un motor cuyas acciones son
   * de documento (`resolveGhosts`, `autoCaption`): no disparan si ningún
   * subtipo comparte su acción, así que un grupo de citas que solo tenga
   * referencias huérfanas ('none') no resuelve nada.
   *
   * Y lo que NO puede garantizar esta función: `autoResolveGhosts` y
   * `autoCaptionAll` son del store y trabajan sobre todo el documento. Hoy su
   * alcance coincide exactamente con los subtipos que las piden (todas las
   * fantasmas son 'cita_fantasma'; todas las figuras/tablas, 'autoCaption'),
   * así que el filtro de subtipos basta. Si algún día un motor marcara una
   * de esas clases como 'mark', la garantía tendría que bajar al store.
   */
  const runGroupAction = useCallback(
    async (group: EngineGroup | SubtypeGroup) => {
      /* La presencia de una PROPIEDAD, no su ausencia: un discriminante de
         unión escrito al revés (`!'massAction' in group`) no lo cubre `tsc` en
         ninguna forma —agregar una propiedad opcional nueva al tipo lo rompe en
         silencio—, y un `EngineGroup` sin `massAction` sería un tipo
         imposible. `groups` es la propiedad que hace único al motor. */
      if (!('groups' in group)) {
        // Fila de subtipo: su propia acción sobre sus propios ítems, sin más.
        await despachar(group.action, group.items);
        return;
      }
      const deAcuerdo = group.groups.filter((g) => g.action === group.massAction);
      if (!deAcuerdo.length) {
        // El rótulo promete una acción en bloque y no hay ninguna: se dice, para
        // que el silencio no se lea como "se aplicó y no pasó nada".
        showToast(
          'Este motor no tiene nada que aplicar en bloque: revisa sus hallazgos uno por uno.',
          'info',
        );
        return;
      }
      await despachar(group.massAction, deAcuerdo.flatMap((g) => g.items));
    },
    [despachar, showToast],
  );

  /* DESCARTAR tiene que salir por los DOS canales, y no por el de esta vista.
     AGENTS.md §2: un hallazgo se anuncia en el subrayado inline y en la burbuja
     del gutter, y se descarta en los dos a la vez — el canal del lienzo es
     `dismissComment(elementId)` del store, que es lo que leen `ReadingText` y
     `WhatsAppComment`. Filtrar solo `dismissedIds` sacaba la fila del rack y
     dejaba la burbuja y su subrayado pegados a la página: la misma
     contradicción, al revés. Un hallazgo sin elemento (una referencia huérfana
     vive en la bibliografía) no tiene a qué anclarse en el lienzo, y por eso
     no hay nada que descartar ahí. */
  const dismiss = useCallback(
    (item: AuditItem) => {
      setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      setSelectedId((prev) => (prev === item.id ? null : prev));
      if (item.element_id) dismissComment(item.element_id);
      showToast('Alerta descartada. Texto original conservado.', 'info');
    },
    [dismissComment, showToast],
  );

  const scanAll = useCallback(async () => {
    setIsScanning(true);
    showToast('Iniciando escaneo integral con IA y heurística local…', 'info');
    try {
      /* Los motores del store tragan sus errores internos: además del catch,
         comprobamos si cada motor dejó resultados NUEVOS en el store. Sin esa
         comprobación, un fallo total parecería un escaneo exitoso. */
      const before = {
        review: useDocStore.getState().reviewResult,
        findings: useDocStore.getState().proofreadFindings,
        indices: useDocStore.getState().aiIndices,
        citations: useDocStore.getState().citationAuditResult,
      };
      const settleEngine = async (
        run: () => Promise<void>,
        producedFreshResult: () => boolean,
      ): Promise<void> => {
        await run();
        if (!producedFreshResult()) throw new Error('sin resultados nuevos');
      };

      const settled = await Promise.allSettled([
        settleEngine(runAIReview, () => useDocStore.getState().reviewResult !== before.review),
        settleEngine(runProofreadBatch, () => {
          const state = useDocStore.getState();
          return state.proofreadFindings !== before.findings || state.aiIndices !== before.indices;
        }),
        settleEngine(runCitationAudit, () => useDocStore.getState().citationAuditResult !== before.citations),
      ]);

      const outcomes: EngineScanOutcome[] = SCAN_ENGINES.map((engine, index) => {
        const result = settled[index];
        return {
          ...engine,
          ok: result.status === 'fulfilled',
          reason: result.status === 'rejected' ? toReason(result.reason) : undefined,
        };
      });

      /* Registrar el último resultado observado por motor: los motores OK
         actualizan sus resultados y un fallo deja de aplicar en cuanto un
         éxito posterior cambie el resultado en el store. */
      const state = useDocStore.getState();
      outcomes.forEach((outcome) => {
        const snap =
          outcome.id === 'ai'
            ? state.reviewResult
            : outcome.id === 'proofread'
              ? ([state.proofreadFindings, state.aiIndices] as const)
              : state.citationAuditResult;
        lastScanRef.current[outcome.id] = { ok: outcome.ok, snap };
      });

      const toast = summarizeScanOutcomes(outcomes);
      showToast(toast.message, toast.type);
    } finally {
      setIsScanning(false);
    }
  }, [runAIReview, runProofreadBatch, runCitationAudit, showToast]);

  /* ── Estado honesto por motor ───────────────────────────────────────────
     "Sin datos" = el motor nunca corrió en esta sesión, O su último
     resultado fue un fallo. Un resultado real — aunque malo — se muestra
     tal cual; solo se elimina el número inventado. */
  const snapMatches = (id: ScanEngineId, snap: unknown): boolean => {
    if (id === 'ai') return snap === reviewResult;
    if (id === 'citations') return snap === citationAuditResult;
    const snapProofread = snap as readonly [typeof proofreadFindings, typeof aiIndices];
    return snapProofread[0] === proofreadFindings && snapProofread[1] === aiIndices;
  };

  const lastRunState = (id: ScanEngineId): 'ok' | 'failed' | null => {
    const record = lastScanRef.current[id];
    if (!record || !snapMatches(id, record.snap)) return null;
    return record.ok ? 'ok' : 'failed';
  };

  const threeEnginesRan =
    reviewResult !== null &&
    lastRunState('ai') !== 'failed' &&
    (aiIndices !== null || proofreadFindings.length > 0) &&
    lastRunState('proofread') !== 'failed' &&
    citationAuditResult !== null &&
    lastRunState('citations') !== 'failed';

  const total = items.length;
  const critical = items.filter((i) => i.severity === 'critical').length;

  return {
    items,
    groups,
    allGroups,
    hasFindings: items.length > 0,
    visibleCount: visibles.length,
    marks,
    highlightIds,
    filter,
    setFilter,
    totalPages,
    currentPage,
    goToPage,
    selected,
    select,
    nextFinding,
    openEngines,
    setOpenEngines,
    openSubtypes,
    setOpenSubtypes,
    acceptOne,
    acceptMany,
    markForReview,
    runGroupAction,
    dismiss,
    markedIds,
    scanAll,
    isScanning,
    isApplying,
    metrics: {
      total,
      critical,
      compliance: threeEnginesRan ? Math.max(0, Math.min(100, 100 - total * 3)) : null,
    },
    viewMode,
    setViewMode,
  };
}
