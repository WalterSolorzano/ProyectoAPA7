/* WordAPA7 — review: capa de datos del workbench.
   Todo lo que antes eran 20 useState y 300 líneas de memos dentro del
   componente. Sin JSX, para poder probar el filtrado, el agrupado, la
   paginación real y la honestidad de las métricas sin DOM.

   Tres reglas que este módulo no negocia:
   1. El detector de IA es PROBABILÍSTICO: propone, la persona decide. Ninguna
      ruta de este archivo aplica una sugerencia suya (ver `aceptaDeIA`).
   2. Un motor que no ha corrido no produce números: `compliance` es `null`
      hasta que los tres motores dejaron resultados, y un motor que falló en
      esta sesión vuelve a `null` (ver `lastRunState`).
   3. Las páginas salen de `usePageIndex` (la paginación real del lienzo). Un
      elemento que no está en el índice devuelve `null`, nunca un número
      estimado: la heurística de 1800 caracteres por página queda en
      `Step5AuditIAWizard.tsx` hasta que ese componente sea reemplazado. */

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

export type EngineId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';
export type EngineFilter = EngineId | 'all';
export type SubtypeAction = 'accept' | 'mark' | 'resolveGhosts' | 'autoCaption' | 'none';
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
}

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
}

export interface ReviewWorkbenchApi {
  /** Hallazgos no descartados, en el orden en que los produjo cada motor */
  items: AuditItem[];
  groups: EngineGroup[];
  /** Una marca por página con hallazgo: color = motor dominante de ESA página */
  marks: Map<number, MinimapMark>;
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
  dismiss: (item: AuditItem) => void;
  markedIds: string[];
  scanAll: () => Promise<void>;
  isScanning: boolean;
  metrics: { total: number; critical: number; compliance: number | null };
  viewMode: 'focus' | 'canvas';
  setViewMode: (m: 'focus' | 'canvas') => void;
}

/** Orden de motores para grupos, chips y minimapa. El motor probabilístico
 *  va al final: es el que menos se ofrece a resolver solo. */
export const ENGINE_ORDER: EngineId[] = ['spelling', 'style', 'structure', 'citations', 'ai'];

export const ENGINE_META: Record<EngineId, { title: string; chip: string; color: string }> = {
  spelling: { title: 'Ortografía', chip: 'Ortografía', color: 'var(--color-danger)' },
  style: { title: 'Redacción & Bloom', chip: 'Redacción & Bloom', color: 'var(--color-accent)' },
  structure: { title: 'Estructura', chip: 'Estructura', color: 'var(--color-info)' },
  citations: { title: 'Citas', chip: 'Citas', color: 'var(--color-warning)' },
  ai: { title: 'Patrones IA', chip: 'Patrones IA', color: 'var(--text-secondary)' },
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
 */
const SUBTYPE_LABELS: Record<string, string> = {
  parrafo_ia: 'Párrafo con índice IA alto',
  frase_ia: 'Frase típica de IA',
  muletilla: 'Muletilla o repetición',
  repeticion: 'Repetición de n-gramas',
  primera_persona: 'Primera persona gramatical',
  verbo_bloom: 'Verbo impreciso en objetivo (Bloom)',
  ortografia: 'Falta ortográfica o tilde',
  texto_pegado: 'Texto pegado sin espaciado',
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
  primera_persona: 'accept',
  verbo_bloom: 'accept',
  ortografia: 'accept',
  texto_pegado: 'accept',
  cita_fantasma: 'resolveGhosts',
  referencia_huerfana: 'none',
  encabezado: 'none',
  figura: 'autoCaption',
  tabla: 'autoCaption',
};

/** Copy del botón masivo de un subtipo, por lo que su motor puede hacer. */
const MASS_LABEL: Record<SubtypeAction, string> = {
  accept: 'Aceptar todas',
  resolveGhosts: 'Resolver',
  autoCaption: 'Auto-Rotular',
  mark: 'Marcar todos',
  none: '',
};

const SEVERITY_RANK: Record<Severity, number> = {
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

const engineMassLabel = (engine: EngineId): string => {
  switch (engine) {
    case 'ai':
      return 'Marcar todos';
    case 'citations':
      return 'Resolver citas';
    case 'structure':
      return 'Auto-Rotular todo';
    default:
      return 'Aceptar todas';
  }
};

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}…` : s);

/* ── Hallazgos del proofreador local ──────────────────────────────────────
   El `kind` del backend decide el motor y el subtipo. Un `kind` que este
   archivo no conoce NO se inventa en otro motor: se descarta, igual que lo
   descartaba el componente, porque un hallazgo sin subtipo ni acción no
   tiene dónde vivir en el panel. */
interface ProofreadRow {
  category: EngineId;
  subtype: string;
  severity: Severity;
  summary: string;
  suggestedText?: string;
}

function proofreadRow(kind: string, f: { excerpt?: string; message: string }): ProofreadRow | null {
  if (kind === 'ai_phrase' || kind === 'muletilla' || kind === 'ngram_repetition') {
    return {
      category: 'ai',
      subtype: kind === 'ai_phrase' ? 'frase_ia' : kind === 'muletilla' ? 'muletilla' : 'repeticion',
      severity: 'medium',
      summary: clip(f.message, 70),
      suggestedText: undefined,
    };
  }
  if (kind === 'first_person' || kind === 'persona' || kind.startsWith('bloom')) {
    const isBloom = kind.startsWith('bloom');
    return {
      category: 'style',
      subtype: isBloom ? 'verbo_bloom' : 'primera_persona',
      severity: isBloom ? 'high' : 'medium',
      summary: isBloom ? 'Verbo impreciso en objetivo académico' : 'Uso de primera persona gramatical',
      suggestedText: isBloom ? 'Determinar y analizar de forma rigurosa' : undefined,
    };
  }
  if (kind === 'ortografia' || kind === 'pegado') {
    const isOrtografia = kind === 'ortografia';
    return {
      category: 'spelling',
      subtype: isOrtografia ? 'ortografia' : 'texto_pegado',
      severity: isOrtografia ? 'high' : 'medium',
      summary: isOrtografia ? `Falta ortográfica o tilde: ${f.excerpt ?? ''}` : 'Texto pegado sin espaciado correcto',
      suggestedText: undefined,
    };
  }
  return null;
}

export function useReviewWorkbench(): ReviewWorkbenchApi {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const aiIndices = useDocStore((s) => s.aiIndices);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  const runAIReview = useDocStore((s) => s.runAIReview);
  const runProofreadBatch = useDocStore((s) => s.runProofreadBatch);
  const runCitationAudit = useDocStore((s) => s.runCitationAudit);
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
  const seeded = useRef(false);

  /* Último escaneo observado por motor (dentro de esta vista): guarda los
     resultados de store en el momento de correr. Si los refs no cambiaron,
     ese sigue siendo el último resultado (éxito o fallo); si cambiaron, un
     éxito posterior — desde cualquier vista — limpia el fallo registrado. */
  const lastScanRef = useRef<Partial<Record<ScanEngineId, { ok: boolean; snap: unknown }>>>({});

  const elements = useMemo(() => doc?.elements || [], [doc]);

  const items = useMemo<AuditItem[]>(() => {
    const out: AuditItem[] = [];
    const byId = new Map(elements.map((e) => [e.id, e]));

    // 1. Detector de IA: párrafos con probabilidad alta o categoría MEDIA+.
    for (const [idx, p] of (reviewResult?.paragraphs || []).entries()) {
      const score = p.ai_score || 0;
      if (!(score >= 45 || p.ai_category === 'HIGH' || p.ai_category === 'MEDIUM')) continue;
      out.push({
        id: `ai_rev_${p.element_id}_${idx}`,
        element_id: p.element_id,
        category: 'ai',
        subtype: 'parrafo_ia',
        severity: score >= 70 ? 'high' : 'medium',
        summary: `Índice de IA ${score || 60}% — rigidez sintética detectada`,
        detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
        originalText: (p.element_id ? byId.get(p.element_id)?.text : '') || p.text || '',
        suggestedText: undefined,
        pageNumber: p.element_id ? pageOf(p.element_id) : null,
        aiScore: (score || 50) / 100,
      });
    }

    // 2. Hallazgos proactivos locales (IA, estilo/Bloom, ortografía y pegado).
    for (const [idx, f] of proofreadFindings.entries()) {
      const row = proofreadRow(String(f.kind), f);
      if (!row) continue;
      out.push({
        id: `proact_${f.element_id}_${idx}`,
        element_id: f.element_id,
        category: row.category,
        subtype: row.subtype,
        severity: row.severity,
        summary: row.summary,
        detail: f.message,
        originalText: (f.element_id ? byId.get(f.element_id)?.text : '') || f.excerpt || '',
        suggestedText: f.suggestion || row.suggestedText,
        pageNumber: f.element_id ? pageOf(f.element_id) : null,
      });
    }

    // 3. Citas fantasma (aparecen en el texto, no en la bibliografía).
    for (const [idx, ghost] of (citationAuditResult?.ghost_citations || []).entries()) {
      const g = ghost as {
        element_id?: string;
        citation_text?: string;
        raw_text?: string;
      };
      const texto = g.citation_text || g.raw_text || 'Desconocida';
      out.push({
        id: `ghost_cite_${idx}`,
        element_id: g.element_id || '',
        category: 'citations',
        subtype: 'cita_fantasma',
        severity: 'critical',
        summary: `Cita "${texto}" ausente en bibliografía`,
        detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
        originalText: g.citation_text || '',
        pageNumber: g.element_id ? pageOf(g.element_id) : null,
      });
    }

    // 4. Referencias huérfanas (en la bibliografía, nunca citadas).
    for (const [idx, orphan] of (citationAuditResult?.orphan_references || []).entries()) {
      const o = orphan as { authors?: string[]; year?: string | number; raw_text?: string };
      out.push({
        id: `orphan_ref_${idx}`,
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
      });
    }

    // 5. Estructura y rotulación APA 7.
    for (const e of elements) {
      if (e.type === 'heading' && e.needs_review) {
        out.push({
          id: `struct_head_${e.id}`,
          element_id: e.id,
          category: 'structure',
          subtype: 'encabezado',
          severity: 'medium',
          summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
          detail: 'Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).',
          originalText: e.text || '',
          pageNumber: pageOf(e.id),
        });
      } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
        out.push({
          id: `struct_fig_${e.id}`,
          element_id: e.id,
          category: 'structure',
          subtype: 'figura',
          severity: 'high',
          summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
          detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
          originalText: '[Figura sin rotular]',
          suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
          pageNumber: pageOf(e.id),
        });
      } else if (e.type === 'table' && !e.table_info?.caption) {
        out.push({
          id: `struct_tbl_${e.id}`,
          element_id: e.id,
          category: 'structure',
          subtype: 'tabla',
          severity: 'high',
          summary: 'Tabla sin rotulación reglamentaria APA 7',
          detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
          originalText: '[Tabla sin rotular]',
          suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
          pageNumber: pageOf(e.id),
        });
      }
    }

    return out.filter((it) => !dismissedIds.includes(it.id));
  }, [reviewResult, proofreadFindings, citationAuditResult, elements, dismissedIds, pageOf]);

  const groups = useMemo<EngineGroup[]>(() => {
    const visibles = filter === 'all' ? items : items.filter((i) => i.category === filter);
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
          massLabel: MASS_LABEL[action],
        };
      });
      subgrupos.sort((a, b) => {
        const ra = Math.min(...a.items.map((i) => SEVERITY_RANK[i.severity]));
        const rb = Math.min(...b.items.map((i) => SEVERITY_RANK[i.severity]));
        return ra - rb || b.items.length - a.items.length;
      });
      return {
        engine,
        title: ENGINE_META[engine].title,
        chip: ENGINE_META[engine].chip,
        count: propios.length,
        criticalHigh: propios.filter((i) => i.severity === 'critical' || i.severity === 'high').length,
        groups: subgrupos,
        massAction: engineAction(engine),
        massLabel: engineMassLabel(engine),
      };
    });
  }, [items, filter]);

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
      const el = pages[page - 1]?.find((e) => e?.id && e.type !== 'page_break');
      if (el) {
        setSelectedElementId(el.id);
        setScrollTargetId(el.id);
      }
      setCurrentPage(page);
    },
    [pages, setSelectedElementId, setScrollTargetId],
  );

  const nextFinding = useCallback(() => {
    // "Siguiente hallazgo" recorre lo que el filtro deja ver: saltar a un
    // hallazgo de un motor apagado sería aterrizar fuera de la lista.
    const visibles = filter === 'all' ? items : items.filter((i) => i.category === filter);
    if (!visibles.length) return;
    const ordenada = [...visibles].sort((a, b) => (a.pageNumber ?? 999) - (b.pageNumber ?? 999));
    const i = ordenada.findIndex((x) => x.id === selectedId);
    const siguiente = ordenada[(i + 1) % ordenada.length];
    setOpenEngines((prev) => (prev.includes(siguiente.category) ? prev : [...prev, siguiente.category]));
    const subkey = `${siguiente.category}:${siguiente.subtype}`;
    setOpenSubtypes((prev) => (prev.includes(subkey) ? prev : [...prev, subkey]));
    select(siguiente.id);
    if (siguiente.pageNumber) setCurrentPage(siguiente.pageNumber);
  }, [items, filter, selectedId, select]);

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
      await aplicar(item);
    },
    [aplicar, showToast],
  );

  const acceptMany = useCallback(
    async (lista: AuditItem[]) => {
      const targets = lista.filter((i) => i.element_id && aceptaDeIA(i));
      if (!targets.length) return;
      let ok = 0;
      for (const it of targets) {
        if (await aplicar(it)) ok += 1;
      }
      if (ok > 0) showToast(`${ok} corrección(es) aplicada(s)`, 'success');
      else showToast('No se pudieron aplicar las correcciones', 'error');
    },
    [aplicar, showToast],
  );

  const markForReview = useCallback(
    (item: AuditItem) => {
      setMarkedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      showToast('Marcado para revisar. El texto original no se modifica.', 'info');
    },
    [showToast],
  );

  const dismiss = useCallback(
    (item: AuditItem) => {
      setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      setSelectedId((prev) => (prev === item.id ? null : prev));
      showToast('Alerta descartada. Texto original conservado.', 'info');
    },
    [showToast],
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
    marks,
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
    dismiss,
    markedIds,
    scanAll,
    isScanning,
    metrics: {
      total,
      critical,
      compliance: threeEnginesRan ? Math.max(0, Math.min(100, 100 - total * 3)) : null,
    },
    viewMode,
    setViewMode,
  };
}
