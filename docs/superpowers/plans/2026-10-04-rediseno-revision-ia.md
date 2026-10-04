# Rediseño de Revisión & IA — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el monolito `Step5AuditIAWizard.tsx` de 866 líneas por una experiencia de revisión guiada por fases: una puerta de estado, un recorrido por fase con riel de categorías + acordeones de corrección, y una sala de IA aparte.

**Architecture:** Tres capas montadas desde el paso 5 del wizard. Capa 1 (`ReviewGate`) es el panel de estado con matriz de calor fase × motor. Capa 2 (`ReviewPhaseJourney`) es el recorrido: encabezado de fase, riel de iconos de categoría interna y un dashboard vertical que termina en acordeones de corrección. Capa 3 (`AiRoom`) es la sala de IA segmentada por títulos, con subrayado inline y comparador. La lógica de recolección de hallazgos vive en un módulo puro (`src/lib/auditItems.ts`) que alimenta las tres capas y el conteo de pendientes del riel.

**Tech Stack:** React 18, TypeScript, Vite 5, Zustand (`useDocStore`), `lucide-react`, Vitest. Backend FastAPI ya existente (endpoints `/api/ai-review`, `/api/proofread-batch`, `/api/validate-citations`).

**Spec:** `docs/superpowers/specs/2026-10-04-rediseno-revision-ia-design.md`

## Global Constraints

- **Cero emojis** en toda la UI. Solo íconos SVG de `lucide-react`.
- **Solo design tokens CSS**: `var(--accent-primary)`, `var(--text-main)`, `var(--text-secondary)`, `var(--border-subtle)`, `var(--surface-elevated)`, `var(--sidebar-bg)`, `var(--canvas-bg)`, `var(--paper-white)`, `var(--paper-ink)`, `var(--accent-success)`, `var(--accent-warning)`, `var(--accent-danger)`, `var(--radius-sm|md|full)`, `var(--text-xs|sm|base)`. **Prohibido** hardcodear hex.
- **Voz sintética (IA) nunca se acepta**: su acción es `Marcar para revisar`. Sí se aceptan hallazgos objetivos (ortografía, formato, estructura, objetivos Bloom).
- **Sin acciones masivas**: no existe "Aplicar todas". Cada corrección se decide por caso, en su acordeón.
- **La portada se mide pero no se escribe**: hallazgos de fase `portada` son de solo lectura — sin `suggestion`, sin botón aceptar, sin marcar.
- **Correcciones = acordeones desplegables**, nunca decisión inline en el dashboard.
- **Claro por defecto** (`theme: 'light'` ya es el default del store).
- El test `noHardcodedColors.test.ts` verifica la ausencia de hex; debe seguir en verde.

## Review Focus

Estas son las entradas/condiciones que el spec implica pero ningún test de tarea cubre directamente. Cada línea lleva su test en la tarea dueña del código.

| # | Condición | Comportamiento esperado |
|---|---|---|
| 1 | Documento sin `reviewResult`, sin `proofreadFindings` y sin `citationAuditResult` | La puerta y el recorrido muestran estado vacío accionable (invitar a escanear), no cifras fabricadas ni listas vacías rotas |
| 2 | Hallazgo con `element_id` que no existe en `doc.elements` | Se agrupa igual (categoría por `kind`), con `pageNumber: 1` y `originalText` del `excerpt`; no rompe el render |
| 3 | Documento sin ningún H1 (solo portada) | La sala de IA muestra un único segmento "Documento completo"; el recorrido no inventa fases |
| 4 | `theme === 'dark'` | El panel de la fase respeta tokens oscuros; el papel del lienzo sigue blanco puro (`--paper-white`) |
| 5 | Hallazgo de fase `portada` (read-only) | No renderiza botón Aceptar ni Marcar; solo lectura. Test lo fija |

---

## File Structure

**Nuevos:**
- `src/lib/auditItems.ts` — módulo puro. Recolecta hallazgos de las tres fuentes del store y los normaliza a `AuditItem[]` con `phase`, `category`, `severity`, `readOnly`. Es la única fuente de la lista que consumen recorrido, puerta y conteo del riel.
- `src/lib/railPending.ts` — conteo de pendientes por fase, derivado de `auditItems.ts`. Alimenta `StepRail`.
- `src/components/review/ReviewGate.tsx` — capa 1 (puerta de estado).
- `src/components/review/ReviewPhaseJourney.tsx` — capa 2 (recorrido por fase).
- `src/components/review/CategoryRail.tsx` — riel de iconos de categoría interna.
- `src/components/review/CategoryDashboard.tsx` — dashboard vertical de la categoría activa.
- `src/components/review/FindingAccordion.tsx` — acordeón de un hallazgo (cerrado = tema, abierto = caso exacto).
- `src/components/review/AiRoom.tsx` — capa 3 (sala de IA segmentada por títulos).
- `src/components/review/AiSegment.tsx` — segmento por título con subrayado inline y confianza.
- `src/components/review/ReadingText.tsx` — render de texto con subrayado inline (dueño único del resaltado).

**Modificados:**
- `src/components/wizard/Step5AuditIAWizard.tsx` — pasa de monolito a orquestador de las tres capas (792 líneas menos).
- `src/App.tsx:54-80` — `pendingCountForPhase` delega en `railPending.ts` (fases 4 y 5 dejan de devolver 0).
- `src/components/wizard/StepRail.tsx` — consume `pendingCountForPhase` compartido.

**Borrados:**
- Ninguno. El monolito se reescribe en su sitio.

**Orden de dependencias:** `auditItems.ts` → `railPending.ts` → `ReadingText.tsx` → `CategoryRail`/`FindingAccordion`/`CategoryDashboard` → `ReviewPhaseJourney` → `ReviewGate` → `AiSegment`/`AiRoom` → orquestador `Step5AuditIAWizard` → integración en `App.tsx`/`StepRail`.

**Límite explícito de este plan (fuera de alcance):** el eje de *fase* (H1 abre ámbito, `RULE_SCOPES`, portada read-only en backend) no existe en `master`: `ProofreadFinding` hoy no tiene `phase` y `proactive_auditor.py` de master no lo emite. Este plan entrega el rediseño de la experiencia con las **categorías internas** y deja el `phase` como una extensión posterior de backend + `AuditItem.phase`. El `readOnly` de portada sí se cubre, derivado de `is_cover_section` y `read_only` en el frontend.

---

### Task 1: Módulo `auditItems` — normalización de hallazgos

**Files:**
- Create: `src/lib/auditItems.ts`
- Test: `src/lib/__tests__/auditItems.test.ts`

**Interfaces:**
- Consumes: `AIReviewResult`, `AIIndicesSummary` de `src/api/backend.ts`; `ProofreadFinding` de `src/types/index.ts`; `DocumentModel` de `src/types/index.ts`.
- Produces:
  - `type ToolWindowId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure'`
  - `type Severity = 'critical' | 'high' | 'medium' | 'low'`
  - `interface AuditItem { id: string; element_id: string; category: ToolWindowId; severity: Severity; summary: string; detail: string; originalText: string; suggestedText?: string; pageNumber: number; aiScore?: number; readOnly: boolean }`
  - `collectAuditItems(input: AuditInput): AuditItem[]`
  - `type AuditInput = { elements: ElementModel[]; reviewResult: AIReviewResult | null; proofreadFindings: ProofreadFinding[]; citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null; dismissedIds?: Set<string> }`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/__tests__/auditItems.test.ts
import { describe, it, expect } from 'vitest';
import { collectAuditItems } from '../auditItems';
import type { ElementModel } from '../../types';

const elem: ElementModel = {
  id: 'e1', type: 'paragraph', text: 'Este párrafo habla de metodología.',
  heading_level: null, needs_review: false,
} as unknown as ElementModel;

describe('collectAuditItems', () => {
  it('marca la ortografía como categoria spelling', () => {
    const items = collectAuditItems({
      elements: [elem],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'e1', start: 0, end: 4, excerpt: 'Este',
        kind: 'ortografia', severity: 'error', message: 'Falta tilde',
        suggestion: 'Éste', source: 'local',
      }],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('spelling');
    expect(items[0].suggestedText).toBe('Éste');
    expect(items[0].readOnly).toBe(false);
  });

  it('no ofrece suggestion en un hallazgo de portada de solo lectura', () => {
    const items = collectAuditItems({
      elements: [{ ...elem, id: 'cover1', is_cover_section: true } as unknown as ElementModel],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'cover1', start: 0, end: 4, excerpt: 'Títu',
        kind: 'portada_punto', severity: 'warn', message: 'Título con punto final',
        suggestion: 'Título', source: 'local', read_only: true,
      }],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].readOnly).toBe(true);
    expect(items[0].suggestedText).toBeUndefined();
  });

  it('un hallazgo con element_id inexistente no rompe y cae en pagina 1', () => {
    const items = collectAuditItems({
      elements: [],
      reviewResult: null,
      proofreadFindings: [{
        element_id: 'fantasma', start: 0, end: 3, excerpt: 'abc',
        kind: 'muletilla', severity: 'warn', message: 'Muletilla',
        source: 'local',
      }],
      citationAuditResult: null,
    });
    expect(items).toHaveLength(1);
    expect(items[0].pageNumber).toBe(1);
    expect(items[0].originalText).toBe('abc');
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/lib/__tests__/auditItems.test.ts`
Expected: FAIL con "Failed to resolve import ../auditItems".

- [ ] **Step 3: Implementar `src/lib/auditItems.ts`**

```ts
/* WordAPA7 — Recolección unificada de hallazgos para la fase Revisión & IA.
   Única fuente de la lista que consumen la puerta, el recorrido y el conteo del riel. */
import type { ElementModel, ProofreadFinding } from '../types';
import type { AIReviewResult } from '../api/backend';

export type ToolWindowId = 'ai' | 'style' | 'spelling' | 'citations' | 'structure';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditItem {
  id: string;
  element_id: string;
  category: ToolWindowId;
  severity: Severity;
  summary: string;
  detail: string;
  originalText: string;
  suggestedText?: string;
  pageNumber: number;
  aiScore?: number;
  readOnly: boolean;
}

export interface AuditInput {
  elements: ElementModel[];
  reviewResult: AIReviewResult | null;
  proofreadFindings: ProofreadFinding[];
  citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null;
  dismissedIds?: Set<string>;
}

const CHARS_POR_PAGINA = 1800;

/** Mapa heurístico elemento → página aproximada. */
export function buildElementPageMap(elements: ElementModel[]): Map<string, number> {
  const map = new Map<string, number>();
  let currentPage = 1;
  let charCount = 0;
  elements.forEach((e) => {
    const len = (e.text || '').length;
    charCount += len;
    if (charCount > CHARS_POR_PAGINA) {
      currentPage += Math.floor(charCount / CHARS_POR_PAGINA);
      charCount = charCount % CHARS_POR_PAGINA;
    }
    map.set(e.id, Math.max(1, currentPage));
  });
  return map;
}

function pageOf(map: Map<string, number>, id: string): number {
  return map.get(id) || 1;
}

export function collectAuditItems(input: AuditInput): AuditItem[] {
  const { elements, reviewResult, proofreadFindings, citationAuditResult } = input;
  const dismissed = input.dismissedIds ?? new Set<string>();
  const pageMap = buildElementPageMap(elements);
  const items: AuditItem[] = [];

  const elemDe = (id: string) => elements.find((e) => e.id === id);
  const esPortada = (e: ElementModel | undefined) => Boolean(e?.is_cover_section);

  if (reviewResult?.paragraphs) {
    reviewResult.paragraphs.forEach((p, idx) => {
      const score = p.ai_score || 0;
      if (score < 45 && p.ai_category !== 'HIGH' && p.ai_category !== 'MEDIUM') return;
      const id = `ai_rev_${p.element_id}_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id,
        element_id: p.element_id,
        category: 'ai',
        severity: score >= 70 ? 'high' : 'medium',
        summary: `Índice de IA ${score || 60}% — rigidez sintáctica detectada`,
        detail: 'Estructura reiterativa y conectores sintéticos característicos de modelos generativos.',
        originalText: elemDe(p.element_id)?.text || p.text || '',
        pageNumber: pageOf(pageMap, p.element_id),
        aiScore: (score || 50) / 100,
        readOnly: false,
      });
    });
  }

  proofreadFindings.forEach((f, idx) => {
    const id = `proact_${f.element_id}_${idx}`;
    if (dismissed.has(id)) return;
    const elem = elemDe(f.element_id);
    const original = elem?.text || f.excerpt || '';
    const k = String(f.kind);
    const readOnly = Boolean(f.read_only) || esPortada(elem);
    const suggestion = readOnly ? undefined : f.suggestion || undefined;

    const base = {
      id, element_id: f.element_id, originalText: original,
      pageNumber: pageOf(pageMap, f.element_id), readOnly,
    };

    if (k === 'ai_phrase' || k === 'muletilla' || k === 'ngram_repetition') {
      items.push({
        ...base, category: 'ai', severity: 'medium',
        summary: f.message.length > 70 ? f.message.slice(0, 70) + '…' : f.message,
        detail: f.message, suggestedText: suggestion,
      });
    } else if (k === 'first_person' || k === 'persona' || k.startsWith('bloom')) {
      const isBloom = k.startsWith('bloom');
      items.push({
        ...base, category: 'style', severity: isBloom ? 'high' : 'medium',
        summary: isBloom ? 'Verbo impreciso en objetivo académico' : 'Uso de primera persona gramatical',
        detail: f.message,
        suggestedText: suggestion ?? (isBloom && !readOnly ? 'Determinar y analizar de forma rigurosa' : undefined),
      });
    } else if (k === 'ortografia' || k === 'pegado') {
      items.push({
        ...base, category: 'spelling', severity: k === 'ortografia' ? 'high' : 'medium',
        summary: k === 'ortografia' ? `Falta ortográfica o tilde: ${f.excerpt}` : 'Texto pegado sin espaciado correcto',
        detail: f.message, suggestedText: suggestion,
      });
    } else {
      items.push({
        ...base, category: 'style', severity: 'low',
        summary: f.message, detail: f.message, suggestedText: suggestion,
      });
    }
  });

  if (citationAuditResult?.ghost_citations) {
    citationAuditResult.ghost_citations.forEach((ghost, idx) => {
      const id = `ghost_cite_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: ghost.element_id || '', category: 'citations', severity: 'critical',
        summary: `Cita "${ghost.citation_text || 'Desconocida'}" ausente en bibliografía`,
        detail: 'Aparece citada en el cuerpo del documento pero no figura en la lista final de referencias.',
        originalText: ghost.citation_text || '',
        pageNumber: ghost.element_id ? pageOf(pageMap, ghost.element_id) : 1,
        readOnly: false,
      });
    });
  }

  if (citationAuditResult?.orphan_references) {
    citationAuditResult.orphan_references.forEach((orphan, idx) => {
      const id = `orphan_ref_${idx}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: '', category: 'citations', severity: 'medium',
        summary: `Referencia "${orphan.authors?.[0] || 'Autor'} (${orphan.year || 's.f.'})" no citada en texto`,
        detail: 'Consta en la bibliografía final pero ninguna sección del documento la referencia expresamente.',
        originalText: orphan.raw_text || '',
        pageNumber: elements.length > 0 ? pageOf(pageMap, elements[elements.length - 1].id) : 1,
        readOnly: false,
      });
    });
  }

  elements.forEach((e) => {
    if (e.type === 'heading' && e.needs_review) {
      const id = `struct_head_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'medium',
        summary: `Encabezado nivel ${e.heading_level || 1} requiere confirmación de jerarquía`,
        detail: 'Verificar que no existan saltos ilegales de nivel (ej. H1 a H3 sin H2 intermedio).',
        originalText: e.text || '', pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    } else if (e.type === 'image' && !e.is_cover_section && !e.image_info?.caption) {
      const id = `struct_fig_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'high',
        summary: 'Figura sin rotulación APA 7 (Figura N y Nota)',
        detail: 'Las normas APA 7 exigen numeración secuencial en negrita, título cursivo y nota explicativa.',
        originalText: '[Figura sin rotular]',
        suggestedText: 'Figura 1. Representación esquemática del procedimiento.',
        pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    } else if (e.type === 'table' && !e.table_info?.caption) {
      const id = `struct_tbl_${e.id}`;
      if (dismissed.has(id)) return;
      items.push({
        id, element_id: e.id, category: 'structure', severity: 'high',
        summary: 'Tabla sin rotulación reglamentaria APA 7',
        detail: 'Requiere etiqueta "Tabla N" superior y nota al pie con la fuente o especificación.',
        originalText: '[Tabla sin rotular]',
        suggestedText: 'Tabla 1. Datos recopilados durante la fase experimental.',
        pageNumber: pageOf(pageMap, e.id), readOnly: false,
      });
    }
  });

  return items;
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/lib/__tests__/auditItems.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auditItems.ts src/lib/__tests__/auditItems.test.ts
git commit -m "feat(review): modulo puro de recoleccion de hallazgos"
```

---

### Task 2: Conteo de pendientes por fase (`railPending`)

**Files:**
- Create: `src/lib/railPending.ts`
- Test: `src/lib/__tests__/railPending.test.ts`

**Interfaces:**
- Consumes: `collectAuditItems`, `AuditItem` de `./auditItems`.
- Produces:
  - `interface RailPendingInput { elements: ElementModel[]; reviewResult: AIReviewResult | null; proofreadFindings: ProofreadFinding[]; citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null; portada: { title?: string; author?: string } }`
  - `pendingCountForPhase(phaseId: number, input: RailPendingInput): number`
  - `readPhaseStates(input: RailPendingInput): Record<number, number>`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/__tests__/railPending.test.ts
import { describe, it, expect } from 'vitest';
import { pendingCountForPhase, readPhaseStates } from '../railPending';

const base = {
  elements: [], reviewResult: null, proofreadFindings: [], citationAuditResult: null,
  portada: { title: 'T', author: 'A' },
};

describe('pendingCountForPhase', () => {
  it('fase 5 devuelve el total de hallazgos de revisión', () => {
    const input = {
      ...base,
      proofreadFindings: [{
        element_id: 'e1', start: 0, end: 2, excerpt: 'ab', kind: 'ortografia',
        severity: 'error' as const, message: 'm', source: 'local' as const,
      }],
    };
    expect(pendingCountForPhase(5, input)).toBe(1);
  });

  it('fase 1 cuenta campos de portada faltantes', () => {
    expect(pendingCountForPhase(1, { ...base, portada: { title: '', author: '' } })).toBe(2);
  });

  it('readPhaseStates incluye las fases 1 a 5', () => {
    const states = readPhaseStates(base);
    expect(Object.keys(states).sort()).toEqual(['1', '2', '3', '4', '5']);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/lib/__tests__/railPending.test.ts`
Expected: FAIL con "Failed to resolve import ../railPending".

- [ ] **Step 3: Implementar `src/lib/railPending.ts`**

```ts
/* WordAPA7 — Conteo de pendientes por fase. Derivado una sola vez desde auditItems.ts.
   Lo consumen StepRail y el atajo de teclado de App.tsx. */
import type { ElementModel, ProofreadFinding } from '../types';
import type { AIReviewResult } from '../api/backend';
import { collectAuditItems } from './auditItems';

export interface RailPendingInput {
  elements: ElementModel[];
  reviewResult: AIReviewResult | null;
  proofreadFindings: ProofreadFinding[];
  citationAuditResult: { ghost_citations: any[]; orphan_references: any[] } | null;
  portada: { title?: string; author?: string };
}

function needsReview(e: any): boolean {
  return Boolean(e?.needs_review);
}

export function pendingCountForPhase(phaseId: number, input: RailPendingInput): number {
  const { elements, portada } = input;

  if (phaseId === 1) {
    let pending = 0;
    if (!portada.title?.trim()) pending++;
    if (!portada.author?.trim()) pending++;
    return pending;
  }
  if (phaseId === 2) {
    return elements.filter((e) => e.type === 'heading' && needsReview(e)).length;
  }
  if (phaseId === 3) {
    const figures = elements.filter(
      (e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0
        && !(e.image_info as any).render_error && needsReview(e),
    ).length;
    const tables = elements.filter(
      (e) => e.type === 'table' && e.table_info && (e.table_info.table_number || 0) > 0 && needsReview(e),
    ).length;
    return figures + tables;
  }
  if (phaseId === 4) {
    return input.citationAuditResult?.ghost_citations?.length ?? 0;
  }
  if (phaseId === 5) {
    return collectAuditItems({
      elements,
      reviewResult: input.reviewResult,
      proofreadFindings: input.proofreadFindings,
      citationAuditResult: input.citationAuditResult,
    }).length;
  }
  return 0;
}

export function readPhaseStates(input: RailPendingInput): Record<number, number> {
  const states: Record<number, number> = {};
  for (let phase = 1; phase <= 5; phase++) {
    states[phase] = pendingCountForPhase(phase, input);
  }
  return states;
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/lib/__tests__/railPending.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/railPending.ts src/lib/__tests__/railPending.test.ts
git commit -m "feat(review): conteo de pendientes por fase derivado de auditItems"
```

---

### Task 3: `ReadingText` — dueño único del subrayado inline

**Files:**
- Create: `src/components/review/ReadingText.tsx`
- Test: `src/components/review/__tests__/ReadingText.test.tsx`

**Interfaces:**
- Consumes: `ProofreadFinding` de `src/types/index.ts`.
- Produces:
  - `interface ReadingMark { element_id: string; start: number; end: number; kind: string; severity: 'info' | 'warn' | 'error' }`
  - `function marksForElement(findings: ProofreadFinding[], elementId: string): ReadingMark[]`
  - `component ReadingText({ text, elementId, findings, renderNote }: { text: string; elementId: string; findings: ProofreadFinding[]; renderNote?: (mark: ReadingMark) => React.ReactNode })`
  - `const MARK_STYLE: Record<string, { color: string; underline: string }>` — solo tokens.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/ReadingText.test.tsx
import { describe, it, expect } from 'vitest';
import { marksForElement, MARK_STYLE } from '../ReadingText';
import type { ProofreadFinding } from '../../../types';

const f = (over: Partial<ProofreadFinding>): ProofreadFinding => ({
  element_id: 'e1', start: 0, end: 3, excerpt: 'abc', kind: 'ai_phrase',
  severity: 'warn', message: 'm', source: 'local', ...over,
});

describe('marksForElement', () => {
  it('devuelve solo las marcas del elemento pedido', () => {
    const findings = [f({}), f({ element_id: 'e2' })];
    expect(marksForElement(findings, 'e1')).toHaveLength(1);
  });

  it('cada kind conocido tiene estilo con tokens, sin hex', () => {
    for (const style of Object.values(MARK_STYLE)) {
      expect(style.color).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style.color).toMatch(/^var\(--/);
    }
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/ReadingText.test.tsx`
Expected: FAIL con "Failed to resolve import ../ReadingText".

- [ ] **Step 3: Implementar `src/components/review/ReadingText.tsx`**

```tsx
/* WordAPA7 — Único dueño del subrayado inline en la fase de revisión.
   Si agregás un resaltado, va acá. Si agregás un tipo de comentario, verificá que se subraye acá. */
import React from 'react';
import type { ProofreadFinding } from '../../types';

export interface ReadingMark {
  element_id: string;
  start: number;
  end: number;
  kind: string;
  severity: 'info' | 'warn' | 'error';
}

export const MARK_STYLE: Record<string, { color: string; underline: string }> = {
  ai_phrase: { color: 'var(--accent-primary)', underline: 'var(--accent-primary)' },
  muletilla: { color: 'var(--text-secondary)', underline: 'var(--text-secondary)' },
  ngram_repetition: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  ortografia: { color: 'var(--accent-danger)', underline: 'var(--accent-danger)' },
  pegado: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  first_person: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  persona: { color: 'var(--accent-warning)', underline: 'var(--accent-warning)' },
  default: { color: 'var(--text-secondary)', underline: 'var(--text-secondary)' },
};

export function marksForElement(findings: ProofreadFinding[], elementId: string): ReadingMark[] {
  return findings
    .filter((f) => f.element_id === elementId && f.end > f.start)
    .map((f) => ({
      element_id: f.element_id, start: f.start, end: f.end,
      kind: String(f.kind), severity: f.severity,
    }))
    .sort((a, b) => a.start - b.start);
}

interface Props {
  text: string;
  elementId: string;
  findings: ProofreadFinding[];
  renderNote?: (mark: ReadingMark) => React.ReactNode;
}

export const ReadingText: React.FC<Props> = ({ text, elementId, findings, renderNote }) => {
  const marks = marksForElement(findings, elementId);
  if (marks.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, i) => {
    if (mark.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, mark.start)}</span>);
    const style = MARK_STYLE[mark.kind] || MARK_STYLE.default;
    parts.push(
      <span
        key={`m${i}`}
        data-mark={mark.kind}
        style={{ borderBottom: `2px solid ${style.underline}`, color: 'inherit' }}
      >
        {text.slice(mark.start, mark.end)}
        {renderNote ? renderNote(mark) : null}
      </span>,
    );
    cursor = mark.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <span>{parts}</span>;
};
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/ReadingText.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verificar que no hay hex hardcodeado**

Run: `npx vitest run src/lib/__tests__/noHardcodedColors.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/review/ReadingText.tsx src/components/review/__tests__/ReadingText.test.tsx
git commit -m "feat(review): ReadingText dueno unico del subrayado inline"
```

---

### Task 4: `CategoryRail` — riel de iconos de categoría

**Files:**
- Create: `src/components/review/CategoryRail.tsx`
- Test: `src/components/review/__tests__/CategoryRail.test.tsx`

**Interfaces:**
- Consumes: `ToolWindowId` de `src/lib/auditItems.ts`.
- Produces:
  - `interface CategoryMeta { id: ToolWindowId; label: string; Icon: React.ElementType }`
  - `const CATEGORY_META: CategoryMeta[]`
  - `component CategoryRail({ active, counts, onSelect }: { active: ToolWindowId; counts: Record<ToolWindowId, number>; onSelect: (id: ToolWindowId) => void })`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/CategoryRail.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryRail, CATEGORY_META } from '../CategoryRail';
import { vi } from 'vitest';

describe('CategoryRail', () => {
  it('no incluye citas entre las categorias del modulo', () => {
    expect(CATEGORY_META.map((c) => c.id)).not.toContain('citations');
  });

  it('muestra el conteo de cada categoria', () => {
    const counts = Object.fromEntries(
      CATEGORY_META.map((c) => [c.id, c.id === 'ai' ? 12 : 0]),
    ) as any;
    render(<CategoryRail active="ai" counts={counts} onSelect={() => {}} />);
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('avisa que categoria se selecciono', () => {
    const onSelect = vi.fn();
    render(<CategoryRail active="ai" counts={{ ai: 1, style: 0, spelling: 0, citations: 0, structure: 0 }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /estilo/i }));
    expect(onSelect).toHaveBeenCalledWith('style');
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/CategoryRail.test.tsx`
Expected: FAIL con "Failed to resolve import ../CategoryRail".

- [ ] **Step 3: Implementar `src/components/review/CategoryRail.tsx`**

```tsx
/* WordAPA7 — Riel de iconos de categorías internas del H1 activo.
   Cambiar de icono reemplaza todo el dashboard derecho. Citas queda fuera del módulo. */
import React from 'react';
import { Bot, PenTool, SpellCheck, Layout } from 'lucide-react';
import type { ToolWindowId } from '../../lib/auditItems';

export interface CategoryMeta {
  id: ToolWindowId;
  label: string;
  Icon: React.ElementType;
}

export const CATEGORY_META: CategoryMeta[] = [
  { id: 'ai', label: 'Voz sintética', Icon: Bot },
  { id: 'style', label: 'Redacción y voz', Icon: PenTool },
  { id: 'spelling', label: 'Formato y estilo', Icon: SpellCheck },
  { id: 'structure', label: 'Estructura', Icon: Layout },
];

interface Props {
  active: ToolWindowId;
  counts: Record<ToolWindowId, number>;
  onSelect: (id: ToolWindowId) => void;
}

export const CategoryRail: React.FC<Props> = ({ active, counts, onSelect }) => (
  <nav
    aria-label="Categorías de revisión"
    style={{
      width: '56px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 0',
      borderRight: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--sidebar-bg)',
    }}
  >
    {CATEGORY_META.map(({ id, label, Icon }) => {
      const isActive = id === active;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-label={label}
          aria-pressed={isActive}
          title={label}
          style={{
            width: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            padding: '6px 0',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid transparent',
            backgroundColor: isActive ? 'var(--color-accent-soft)' : 'transparent',
            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Icon size={18} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800 }}>{counts[id] ?? 0}</span>
        </button>
      );
    })}
  </nav>
);
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/CategoryRail.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/CategoryRail.tsx src/components/review/__tests__/CategoryRail.test.tsx
git commit -m "feat(review): riel de categorias internas del H1"
```

---

### Task 5: `FindingAccordion` — acordeón de un hallazgo

**Files:**
- Create: `src/components/review/FindingAccordion.tsx`
- Test: `src/components/review/__tests__/FindingAccordion.test.tsx`

**Interfaces:**
- Consumes: `AuditItem` de `src/lib/auditItems.ts`.
- Produces:
  - `interface FindingAction { label: 'Aceptar' | 'Marcar para revisar' | 'Descartar'; onRun: () => void }`
  - `function actionsForItem(item: AuditItem): FindingAction['label'][]` — IA nunca devuelve 'Aceptar'; portada read-only devuelve `[]`.
  - `component FindingAccordion({ item, open, onToggle, onAccept, onMark, onDismiss }: {...})`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/FindingAccordion.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindingAccordion, actionsForItem } from '../FindingAccordion';
import { vi } from 'vitest';
import type { AuditItem } from '../../../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'ai', severity: 'medium',
  summary: 'Frase sintética', detail: 'detalle', originalText: 'original',
  suggestedText: 'propuesta', pageNumber: 1, readOnly: false, ...over,
});

describe('actionsForItem', () => {
  it('la voz sintetica nunca ofrece Aceptar', () => {
    expect(actionsForItem(item({ category: 'ai' }))).toEqual(['Marcar para revisar', 'Descartar']);
  });

  it('la ortografia si ofrece Aceptar', () => {
    expect(actionsForItem(item({ category: 'spelling' }))).toContain('Aceptar');
  });

  it('un hallazgo de portada es de solo lectura', () => {
    expect(actionsForItem(item({ readOnly: true }))).toEqual([]);
  });
});

describe('FindingAccordion', () => {
  it('cerrado muestra el tema, abierto muestra el caso exacto', () => {
    const { rerender } = render(
      <FindingAccordion item={item({})} open={false} onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Frase sintética')).toBeTruthy();
    expect(screen.queryByText('propuesta')).toBeNull();
    rerender(
      <FindingAccordion item={item({})} open onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('propuesta')).toBeTruthy();
  });

  it('no muestra boton de aceptar en un hallazgo de solo lectura', () => {
    render(
      <FindingAccordion item={item({ readOnly: true })} open onToggle={() => {}} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/FindingAccordion.test.tsx`
Expected: FAIL con "Failed to resolve import ../FindingAccordion".

- [ ] **Step 3: Implementar `src/components/review/FindingAccordion.tsx`**

```tsx
/* WordAPA7 — Acordeón de un hallazgo. Cerrado = tema; abierto = caso exacto (cita + análisis + propuesta). */
import React from 'react';
import { ChevronDown, ChevronRight, Check, Bookmark, X, Lock } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';

export interface FindingAction {
  label: 'Aceptar' | 'Marcar para revisar' | 'Descartar';
  onRun: () => void;
}

/** Regla de motores: objetivo → Aceptar; probabilístico (IA) → solo Marcar. Portada read-only → nada. */
export function actionsForItem(item: AuditItem): FindingAction['label'][] {
  if (item.readOnly) return [];
  if (item.category === 'ai') return ['Marcar para revisar', 'Descartar'];
  return ['Aceptar', 'Descartar'];
}

interface Props {
  item: AuditItem;
  open: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onMark: () => void;
  onDismiss: () => void;
}

export const FindingAccordion: React.FC<Props> = ({ item, open, onToggle, onAccept, onMark, onDismiss }) => {
  const acciones = actionsForItem(item);
  return (
    <section
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-main)' }}>
          {item.summary}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Pág. {item.pageNumber}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px 36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{item.detail}</p>

          <div
            style={{
              padding: '8px 10px',
              borderLeft: '2px solid var(--border-subtle)',
              backgroundColor: 'var(--sidebar-bg)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-main)',
            }}
          >
            {item.originalText}
          </div>

          {item.suggestedText && (
            <div
              style={{
                padding: '8px 10px',
                borderLeft: '2px solid var(--accent-primary)',
                backgroundColor: 'var(--color-accent-soft)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-main)',
              }}
            >
              {item.suggestedText}
            </div>
          )}

          {item.readOnly ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              <Lock size={12} /> Zona protegida: se revisa, no se escribe.
            </span>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {acciones.includes('Descartar') && (
                <button type="button" onClick={onDismiss} style={ghostBtn}>
                  <X size={12} /> Descartar
                </button>
              )}
              {acciones.includes('Marcar para revisar') && (
                <button type="button" onClick={onMark} style={ghostBtn}>
                  <Bookmark size={12} /> Marcar para revisar
                </button>
              )}
              {acciones.includes('Aceptar') && (
                <button type="button" onClick={onAccept} style={solidBtn}>
                  <Check size={12} /> Aceptar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--accent-primary)',
  color: 'var(--paper-white)', fontSize: 'var(--text-xs)', fontWeight: 800, cursor: 'pointer',
};
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/FindingAccordion.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/FindingAccordion.tsx src/components/review/__tests__/FindingAccordion.test.tsx
git commit -m "feat(review): acordeon de hallazgo con reglas de motor"
```

---

### Task 6: `CategoryDashboard` y `ReviewPhaseJourney` — capa 2

**Files:**
- Create: `src/components/review/CategoryDashboard.tsx`
- Create: `src/components/review/ReviewPhaseJourney.tsx`
- Test: `src/components/review/__tests__/CategoryDashboard.test.tsx`

**Interfaces:**
- Consumes: `AuditItem`, `ToolWindowId` de `src/lib/auditItems.ts`; `CategoryRail`, `CATEGORY_META` de `./CategoryRail`; `FindingAccordion`, `actionsForItem` de `./FindingAccordion`.
- Produces:
  - `function groupByTheme(items: AuditItem[]): { key: string; title: string; items: AuditItem[] }[]`
  - `component CategoryDashboard({ category, items, onAccept, onMark, onDismiss }: {...})`
  - `component ReviewPhaseJourney({ items, onAccept, onMark, onDismiss, onBack, onOpenAiRoom }: {...})` — maneja internamente `activeCategory` y `openItemId`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/CategoryDashboard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryDashboard, groupByTheme } from '../CategoryDashboard';
import type { AuditItem } from '../../../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'style', severity: 'medium',
  summary: 'Objetivo con verbo vago', detail: 'detalle', originalText: 'original',
  suggestedText: 'propuesta', pageNumber: 2, readOnly: false, ...over,
});

describe('groupByTheme', () => {
  it('agrupa por categoria y subtema sin perder items', () => {
    const items = [item({}), item({ id: 'y' })];
    const grupos = groupByTheme(items);
    expect(grupos.flatMap((g) => g.items)).toHaveLength(2);
  });
});

describe('CategoryDashboard', () => {
  it('muestra la cifra grande de la categoria', () => {
    render(
      <CategoryDashboard category="style" items={[item({}), item({ id: 'y' })]} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('cada correccion esta cerrada por defecto', () => {
    render(
      <CategoryDashboard category="style" items={[item({})]} onAccept={() => {}} onMark={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByText('propuesta')).toBeNull();
    fireEvent.click(screen.getByText('Objetivo con verbo vago'));
    expect(screen.getByText('propuesta')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/CategoryDashboard.test.tsx`
Expected: FAIL con "Failed to resolve import ../CategoryDashboard".

- [ ] **Step 3: Implementar `src/components/review/CategoryDashboard.tsx`**

```tsx
/* WordAPA7 — Dashboard vertical de una categoría: cifra grande, gráfico, y acordeones de corrección. */
import React, { useMemo, useState } from 'react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { CATEGORY_META } from './CategoryRail';
import { FindingAccordion } from './FindingAccordion';

export interface FindingTheme {
  key: string;
  title: string;
  items: AuditItem[];
}

/** Agrupa por tema. El tema se deriva de la categoría y del motivo del hallazgo; preserva todo item. */
export function groupByTheme(items: AuditItem[]): FindingTheme[] {
  const temaDe = (it: AuditItem): { key: string; title: string } => {
    if (it.category === 'spelling') return { key: 'spelling', title: 'Ortografía y texto pegado' };
    if (it.category === 'structure') return { key: 'structure', title: 'Jerarquía y rotulación' };
    if (it.category === 'ai') return { key: 'ai', title: 'Voz sintética detectada' };
    // Categoría 'style': separa objetivos Bloom del resto de redacción y voz.
    if (/objetivo|verbo/i.test(it.summary)) return { key: 'style-objetivos', title: 'Objetivos y verbos' };
    return { key: 'style-voz', title: 'Redacción y voz' };
  };

  const order: string[] = [];
  const buckets = new Map<string, FindingTheme>();
  items.forEach((it) => {
    const { key, title } = temaDe(it);
    if (!buckets.has(key)) {
      buckets.set(key, { key, title, items: [] });
      order.push(key);
    }
    buckets.get(key)!.items.push(it);
  });
  return order.map((k) => buckets.get(k)!);
}

interface Props {
  category: ToolWindowId;
  items: AuditItem[];
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  activeItemId?: string | null;
  onOpenItem?: (id: string) => void;
}

export const CategoryDashboard: React.FC<Props> = ({
  category, items, onAccept, onMark, onDismiss, activeItemId, onOpenItem,
}) => {
  const temas = useMemo(() => groupByTheme(items), [items]);
  const meta = CATEGORY_META.find((c) => c.id === category);
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const openId = activeItemId !== undefined ? activeItemId : localOpen;

  const toggle = (id: string) => {
    if (onOpenItem) onOpenItem(openId === id ? '' : id);
    else setLocalOpen(openId === id ? null : id);
  };

  if (items.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
        {meta ? <meta.Icon size={22} /> : null}
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Esta categoría no tiene observaciones.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
          {meta?.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '44px', fontWeight: 900, lineHeight: 1, color: 'var(--accent-primary)' }}>{items.length}</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>observaciones en esta categoría</span>
        </div>
      </header>

      {temas.map((tema) => (
        <section key={tema.key} style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
            {tema.title} · {tema.items.length}
          </h3>
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {tema.items.map((it) => (
              <FindingAccordion
                key={it.id}
                item={it}
                open={openId === it.id}
                onToggle={() => toggle(it.id)}
                onAccept={() => onAccept(it)}
                onMark={() => onMark(it)}
                onDismiss={() => onDismiss(it)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
```

- [ ] **Step 4: Implementar `src/components/review/ReviewPhaseJourney.tsx`**

```tsx
/* WordAPA7 — Capa 2: recorrido por fase. Categoría activa + riel + dashboard vertical. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';
import { CategoryRail, CATEGORY_META } from './CategoryRail';
import { CategoryDashboard } from './CategoryDashboard';

interface Props {
  items: AuditItem[];
  phaseLabel: string;
  onAccept: (item: AuditItem) => void;
  onMark: (item: AuditItem) => void;
  onDismiss: (item: AuditItem) => void;
  onBack: () => void;
  onOpenAiRoom: () => void;
}

export const ReviewPhaseJourney: React.FC<Props> = ({
  items, phaseLabel, onAccept, onMark, onDismiss, onBack, onOpenAiRoom,
}) => {
  const counts = useMemo(() => {
    const c: Record<ToolWindowId, number> = { ai: 0, style: 0, spelling: 0, citations: 0, structure: 0 };
    items.forEach((it) => { c[it.category] += 1; });
    return c;
  }, [items]);

  const disponibles = useMemo(
    () => CATEGORY_META.filter((c) => counts[c.id] > 0).map((c) => c.id),
    [counts],
  );
  const [active, setActive] = useState<ToolWindowId>(disponibles[0] ?? 'style');

  const visibles = useMemo(() => items.filter((it) => it.category === active), [items, active]);
  const aiCount = counts.ai;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      <CategoryRail active={active} counts={counts} onSelect={setActive} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button type="button" onClick={onBack} style={backBtn}>
            <ArrowLeft size={14} /> Estado del documento
          </button>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-main)' }}>
            {phaseLabel}
          </span>
          {aiCount > 0 && (
            <button type="button" onClick={onOpenAiRoom} style={backBtn}>
              <Sparkles size={14} /> Sala de IA · {aiCount}
            </button>
          )}
        </header>

        <CategoryDashboard
          category={active}
          items={visibles}
          onAccept={onAccept}
          onMark={onMark}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
};

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/CategoryDashboard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/review/CategoryDashboard.tsx src/components/review/ReviewPhaseJourney.tsx src/components/review/__tests__/CategoryDashboard.test.tsx
git commit -m "feat(review): dashboard de categoria y recorrido por fase"
```

---

### Task 7: `ReviewGate` — capa 1, puerta de estado

**Files:**
- Create: `src/components/review/ReviewGate.tsx`
- Test: `src/components/review/__tests__/ReviewGate.test.tsx`

**Interfaces:**
- Consumes: `AuditItem`, `ToolWindowId` de `src/lib/auditItems.ts`.
- Produces:
  - `function heatMatrix(items: AuditItem[]): Record<ToolWindowId, number>`
  - `component ReviewGate({ items, aiScore, onStart, onOpenAiRoom, isScanning, onScan }: {...})`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/ReviewGate.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewGate, heatMatrix } from '../ReviewGate';
import type { AuditItem } from '../../../lib/auditItems';

const item = (over: Partial<AuditItem>): AuditItem => ({
  id: 'x', element_id: 'e1', category: 'ai', severity: 'medium',
  summary: 's', detail: 'd', originalText: 'o', pageNumber: 1, readOnly: false, ...over,
});

describe('heatMatrix', () => {
  it('cuenta hallazgos por categoria', () => {
    const m = heatMatrix([item({}), item({ category: 'spelling' })]);
    expect(m.ai).toBe(1);
    expect(m.spelling).toBe(1);
  });
});

describe('ReviewGate', () => {
  it('muestra estado vacio accionable sin datos', () => {
    render(<ReviewGate items={[]} aiScore={0} onStart={() => {}} onOpenAiRoom={() => {}} isScanning={false} onScan={() => {}} />);
    expect(screen.getByText(/escanear/i)).toBeTruthy();
  });

  it('con hallazgos muestra el total y el CTA de empezar', () => {
    render(<ReviewGate items={[item({}), item({ id: 'y' })]} aiScore={18} onStart={() => {}} onOpenAiRoom={() => {}} isScanning={false} onScan={() => {}} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText(/empezar revisión/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/ReviewGate.test.tsx`
Expected: FAIL con "Failed to resolve import ../ReviewGate".

- [ ] **Step 3: Implementar `src/components/review/ReviewGate.tsx`**

```tsx
/* WordAPA7 — Capa 1: puerta de estado. Cifra principal, sub-cifras y matriz de calor fase × motor. */
import React, { useMemo } from 'react';
import { ShieldCheck, Sparkles, ArrowRight, Bot, PenTool, SpellCheck, Layout } from 'lucide-react';
import type { AuditItem, ToolWindowId } from '../../lib/auditItems';

export function heatMatrix(items: AuditItem[]): Record<ToolWindowId, number> {
  const m: Record<ToolWindowId, number> = { ai: 0, style: 0, spelling: 0, citations: 0, structure: 0 };
  items.forEach((it) => { m[it.category] += 1; });
  return m;
}

const MOTORES: { id: ToolWindowId; label: string; Icon: React.ElementType }[] = [
  { id: 'ai', label: 'Voz sintética', Icon: Bot },
  { id: 'style', label: 'Redacción y voz', Icon: PenTool },
  { id: 'spelling', label: 'Formato y estilo', Icon: SpellCheck },
  { id: 'structure', label: 'Estructura', Icon: Layout },
];

interface Props {
  items: AuditItem[];
  aiScore: number;
  isScanning: boolean;
  onScan: () => void;
  onStart: () => void;
  onOpenAiRoom: () => void;
}

export const ReviewGate: React.FC<Props> = ({ items, aiScore, isScanning, onScan, onStart, onOpenAiRoom }) => {
  const matrix = useMemo(() => heatMatrix(items), [items]);
  const total = items.length;
  const aiCount = matrix.ai;

  if (total === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
        <div style={{ color: 'var(--accent-primary)' }}><ShieldCheck size={32} /></div>
        <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)' }}>Aún no hay una revisión</h2>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Ejecutá el escaneo para medir ortografía, voz, estructura y voz sintética.
        </p>
        <button type="button" onClick={onScan} disabled={isScanning} style={solidBtn}>
          <Sparkles size={14} /> Escanear documento
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px' }}>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
        Paso 5 · Revisión & IA
      </span>
      <h1 style={{ margin: '4px 0 24px', fontSize: '28px', fontWeight: 900, color: 'var(--text-main)' }}>Estado de tu documento</h1>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1, color: 'var(--accent-primary)' }}>{total}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>observaciones por revisar</span>
      </div>

      <div style={{ display: 'flex', gap: '40px', margin: '28px 0' }}>
        <SubCifra valor={Math.round(aiScore * 100) + '%'} etiqueta="voz sintética" />
        <SubCifra valor={String(aiCount)} etiqueta="fragmentos con IA" />
        <SubCifra valor={String(new Set(items.map((i) => i.category)).size)} etiqueta="categorías con hallazgos" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '520px', marginBottom: '28px' }}>
        {MOTORES.map(({ id, label, Icon }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <Icon size={16} />
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--text-main)' }}>{label}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: matrix[id] > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{matrix[id]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={onStart} style={solidBtn}>
          Empezar revisión <ArrowRight size={14} />
        </button>
        {aiCount > 0 && (
          <button type="button" onClick={onOpenAiRoom} style={ghostBtn}>
            <Sparkles size={14} /> Ver sala de IA
          </button>
        )}
      </div>
    </div>
  );
};

const SubCifra: React.FC<{ valor: string; etiqueta: string }> = ({ valor, etiqueta }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)' }}>{valor}</span>
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{etiqueta}</span>
  </div>
);

const solidBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--accent-primary)', color: 'var(--paper-white)',
  fontSize: 'var(--text-sm)', fontWeight: 800, cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '10px 18px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-main)', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer',
};
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/ReviewGate.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/review/ReviewGate.tsx src/components/review/__tests__/ReviewGate.test.tsx
git commit -m "feat(review): puerta de estado con matriz de calor fase por motor"
```

---

### Task 8: `AiRoom` y `AiSegment` — capa 3, sala de IA

**Files:**
- Create: `src/components/review/AiSegment.tsx`
- Create: `src/components/review/AiRoom.tsx`
- Test: `src/components/review/__tests__/AiRoom.test.tsx`

**Interfaces:**
- Consumes: `ReadingText`, `marksForElement` de `./ReadingText`; `AIReviewResult`, `AIReviewParagraph` de `src/api/backend.ts`; `ElementModel` de `src/types/index.ts`.
- Produces:
  - `function segmentsFromParagraphs(paragraphs: { element_id: string; text: string; ai_score: number; ai_category: string }[], elements: ElementModel[]): { id: string; title: string; paragraphs: typeof paragraphs }[]`
  - `component AiSegment({ title, paragraphs, findings, onMark, index, total, onPrev, onNext }: {...})`
  - `component AiRoom({ reviewResult, findings, onMark, onExit }: {...})`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/review/__tests__/AiRoom.test.tsx
import { describe, it, expect } from 'vitest';
import { segmentsFromParagraphs } from '../AiRoom';
import type { ElementModel } from '../../../types';

const el = (id: string, type: string, text: string): ElementModel =>
  ({ id, type, text } as unknown as ElementModel);

describe('segmentsFromParagraphs', () => {
  it('agrupa los parrafos bajo su H1', () => {
    const elements = [el('h1', 'heading', 'Resultados'), el('p1', 'paragraph', 'texto')];
    const segs = segmentsFromParagraphs([{ element_id: 'p1', text: 'texto', ai_score: 80, ai_category: 'HIGH' }], elements);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.flatMap((s) => s.paragraphs)).toHaveLength(1);
  });

  it('sin H1 cae en un unico segmento de documento completo', () => {
    const segs = segmentsFromParagraphs([{ element_id: 'p1', text: 'x', ai_score: 80, ai_category: 'HIGH' }], [el('p1', 'paragraph', 'x')]);
    expect(segs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/review/__tests__/AiRoom.test.tsx`
Expected: FAIL con "Failed to resolve import ../AiRoom".

- [ ] **Step 3: Implementar `src/components/review/AiSegment.tsx`**

```tsx
/* WordAPA7 — Un segmento de la sala de IA: subrayado inline violeta + confianza + comparador. */
import React from 'react';
import { ArrowLeft, ArrowRight, Bookmark } from 'lucide-react';
import { ReadingText } from './ReadingText';
import type { ProofreadFinding } from '../../types';

interface ParagraphLike { element_id: string; text: string; ai_score: number; ai_category: string }

interface Props {
  title: string;
  paragraphs: ParagraphLike[];
  findings: ProofreadFinding[];
  index: number;
  total: number;
  onMark: (elementId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const AiSegment: React.FC<Props> = ({
  title, paragraphs, findings, index, total, onMark, onPrev, onNext,
}) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ flex: 1, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--text-main)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sección {index + 1} de {total}</span>
      <button type="button" onClick={onPrev} disabled={index === 0} style={navBtn} aria-label="Sección anterior"><ArrowLeft size={14} /></button>
      <button type="button" onClick={onNext} disabled={index >= total - 1} style={navBtn} aria-label="Sección siguiente"><ArrowRight size={14} /></button>
    </header>

    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {paragraphs.map((p) => (
        <article key={p.element_id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <ReadingText
            text={p.text}
            elementId={p.element_id}
            findings={findings}
            renderNote={(mark) => (
              <sup
                title={`Confianza IA detectada: ${mark.kind}`}
                style={{ marginLeft: '2px', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--accent-primary)' }}
              >
                {Math.round(p.ai_score)}%
              </sup>
            )}
          />
          <button type="button" onClick={() => onMark(p.element_id)} style={markBtn}>
            <Bookmark size={12} /> Marcar para revisar
          </button>
        </article>
      ))}
    </div>
  </div>
);

const navBtn: React.CSSProperties = {
  padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer',
};
const markBtn: React.CSSProperties = {
  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};
```

- [ ] **Step 4: Implementar `src/components/review/AiRoom.tsx`**

```tsx
/* WordAPA7 — Capa 3: sala de IA aparte, segmentada por títulos H1/H2. */
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { AIReviewResult } from '../../api/backend';
import type { ElementModel, ProofreadFinding } from '../../types';
import { AiSegment } from './AiSegment';

interface ParagraphLike { element_id: string; text: string; ai_score: number; ai_category: string }

const navBtnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
};

/** Segmenta los párrafos por H1. Sin H1 devuelve un único segmento "Documento completo". */
export function segmentsFromParagraphs(
  paragraphs: ParagraphLike[],
  elements: ElementModel[],
): { id: string; title: string; paragraphs: ParagraphLike[] }[] {
  const h1s = elements.filter((e) => e.type === 'heading' && (e.heading_level || 1) === 1);
  if (h1s.length === 0) {
    return [{ id: 'doc', title: 'Documento completo', paragraphs }];
  }
  const orden = elements.map((e) => e.id);
  const posH1 = h1s.map((h) => orden.indexOf(h.id));
  const segs = h1s.map((h) => ({
    id: h.id, title: h.text || 'Sección', paragraphs: [] as ParagraphLike[],
  }));
  paragraphs.forEach((p) => {
    const pos = orden.indexOf(p.element_id);
    let target = 0;
    for (let i = 0; i < posH1.length; i++) {
      if (posH1[i] <= pos) target = i;
    }
    if (segs[target]) segs[target].paragraphs.push(p);
  });
  return segs.filter((s) => s.paragraphs.length > 0);
}

interface Props {
  reviewResult: AIReviewResult | null;
  elements: ElementModel[];
  findings: ProofreadFinding[];
  onMark: (elementId: string) => void;
  onExit: () => void;
}

export const AiRoom: React.FC<Props> = ({ reviewResult, elements, findings, onMark, onExit }) => {
  const paragraphs = (reviewResult?.paragraphs ?? []) as ParagraphLike[];
  const [index, setIndex] = useState(0);

  const segs = useMemo(() => segmentsFromParagraphs(paragraphs, elements), [paragraphs, elements]);

  if (paragraphs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '40px' }}>
        <Sparkles size={28} />
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Aún no hay un análisis de voz sintética.</p>
        <button type="button" onClick={onExit} style={navBtnGhost}>
          <ArrowLeft size={14} /> Volver al estado del documento
        </button>
      </div>
    );
  }

  const safeIndex = Math.min(index, Math.max(0, segs.length - 1));
  const current = segs[safeIndex];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: 'var(--canvas-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={onExit} style={navBtnGhost}>
          <ArrowLeft size={14} /> Estado del documento
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sala de IA · solo marcar para revisar</span>
      </div>
      <AiSegment
        title={current.title}
        paragraphs={current.paragraphs}
        findings={findings}
        index={safeIndex}
        total={segs.length}
        onMark={onMark}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(segs.length - 1, i + 1))}
      />
    </div>
  );
};
```

> **Nota de implementación:** `AiRoom` recibe `elements` como prop desde el orquestador (Task 9); no los lee de `reviewResult`.

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npx vitest run src/components/review/__tests__/AiRoom.test.tsx`
Expected: PASS (2 tests). Si falla por la nota de `elements`, ajustar la firma como indica la nota y volver a correr.

- [ ] **Step 6: Commit**

```bash
git add src/components/review/AiSegment.tsx src/components/review/AiRoom.tsx src/components/review/__tests__/AiRoom.test.tsx
git commit -m "feat(review): sala de IA segmentada por titulos"
```

---

### Task 9: Orquestador `Step5AuditIAWizard`

**Files:**
- Modify: `src/components/wizard/Step5AuditIAWizard.tsx` (reescritura completa, 866 → ~150 líneas)
- Test: `src/components/wizard/__tests__/Step5AuditIAWizard.test.tsx`

**Interfaces:**
- Consumes: `collectAuditItems`, `AuditItem` de `src/lib/auditItems.ts`; `ReviewGate`, `ReviewPhaseJourney`, `AiRoom` de `src/components/review/*`.
- Produces: `export const Step5AuditIAWizard: React.FC` — sin props (mismo contrato que hoy).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// src/components/wizard/__tests__/Step5AuditIAWizard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const state: any = {
  doc: { elements: [], session_id: 's1' },
  reviewResult: null, proofreadFindings: [], citationAuditResult: null,
  runAIReview: vi.fn(), runProofreadBatch: vi.fn(), runCitationAudit: vi.fn(),
  showToast: vi.fn(), setSelectedElementId: vi.fn(), setScrollTargetId: vi.fn(),
  updateElementText: vi.fn(),
};

vi.mock('../../store/useDocStore', () => ({
  useDocStore: (sel: any) => (typeof sel === 'function' ? sel(state) : state),
}));

import { Step5AuditIAWizard } from '../Step5AuditIAWizard';

describe('Step5AuditIAWizard', () => {
  beforeEach(() => { state.reviewResult = null; state.proofreadFindings = []; });

  it('sin datos muestra la puerta con estado vacio', () => {
    render(<Step5AuditIAWizard />);
    expect(screen.getByText(/escanear/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/components/wizard/__tests__/Step5AuditIAWizard.test.tsx`
Expected: FAIL porque el monolito actual no renderiza "Escanear documento" en un `<button>` con ese texto en el estado vacío (renderiza el rack con "Sin observaciones").

- [ ] **Step 3: Reescribir `src/components/wizard/Step5AuditIAWizard.tsx`**

```tsx
/* WordAPA7 — Paso 5: orquestador del rediseño de Revisión & IA.
   Tres capas: puerta de estado, recorrido por fase, sala de IA. */
import React, { useMemo, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { collectAuditItems, type AuditItem } from '../../lib/auditItems';
import { ReviewGate } from '../review/ReviewGate';
import { ReviewPhaseJourney } from '../review/ReviewPhaseJourney';
import { AiRoom } from '../review/AiRoom';
import * as api from '../../api/backend';

type Pantalla = 'gate' | 'journey' | 'ai';

export const Step5AuditIAWizard: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings || []);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const runAIReview = useDocStore((s) => s.runAIReview);
  const runProofreadBatch = useDocStore((s) => s.runProofreadBatch);
  const runCitationAudit = useDocStore((s) => s.runCitationAudit);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const showToast = useDocStore((s) => s.showToast);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);

  const [pantalla, setPantalla] = useState<Pantalla>('gate');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  const elements = useMemo(() => doc?.elements || [], [doc]);

  const items = useMemo(
    () => collectAuditItems({ elements, reviewResult, proofreadFindings, citationAuditResult, dismissedIds }),
    [elements, reviewResult, proofreadFindings, citationAuditResult, dismissedIds],
  );

  const aiScore = reviewResult?.ai_indices?.score ?? 0;

  const handleScan = async () => {
    setIsScanning(true);
    showToast('Iniciando escaneo integral con IA y heurística local…', 'info');
    try {
      await Promise.allSettled([runAIReview(), runProofreadBatch(), runCitationAudit()]);
      showToast('Auditoría integral completada', 'success');
    } catch {
      showToast('Error al ejecutar el escaneo completo', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAccept = async (item: AuditItem) => {
    if (!doc || !item.element_id || item.readOnly) return;
    try {
      if (item.suggestedText) {
        await updateElementText(item.element_id, item.suggestedText);
      } else {
        const rewritten = await api.rewriteText(
          doc.session_id, item.element_id, item.originalText,
          'Reescribir en voz formal impersonal académica según APA 7, eliminando rigidez y muletillas',
        );
        if (rewritten) await updateElementText(item.element_id, rewritten);
      }
      showToast('Corrección aplicada al documento', 'success');
      setDismissedIds((prev) => new Set(prev).add(item.id));
    } catch {
      showToast('Error al aplicar la sugerencia', 'error');
    }
  };

  const handleMark = (item: AuditItem) => {
    if (item.element_id) {
      setSelectedElementId(item.element_id);
      setScrollTargetId(item.element_id);
    }
    showToast('Marcado para revisar', 'info');
  };

  const handleDismiss = (item: AuditItem) => {
    setDismissedIds((prev) => new Set(prev).add(item.id));
    showToast('Alerta descartada. Texto original conservado.', 'info');
  };

  if (pantalla === 'ai') {
    return (
      <AiRoom
        reviewResult={reviewResult}
        elements={elements}
        findings={proofreadFindings}
        onMark={(id) => handleMark({ element_id: id } as AuditItem)}
        onExit={() => setPantalla('gate')}
      />
    );
  }

  if (pantalla === 'journey') {
    return (
      <ReviewPhaseJourney
        items={items}
        phaseLabel="Recorrido de revisión"
        onAccept={handleAccept}
        onMark={handleMark}
        onDismiss={handleDismiss}
        onBack={() => setPantalla('gate')}
        onOpenAiRoom={() => setPantalla('ai')}
      />
    );
  }

  return (
    <ReviewGate
      items={items}
      aiScore={aiScore}
      isScanning={isScanning}
      onScan={handleScan}
      onStart={() => setPantalla('journey')}
      onOpenAiRoom={() => setPantalla('ai')}
    />
  );
};

export default Step5AuditIAWizard;
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/components/wizard/__tests__/Step5AuditIAWizard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Verificar que no hay hex hardcodeado en lo nuevo**

Run: `npx vitest run src/lib/__tests__/noHardcodedColors.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/wizard/Step5AuditIAWizard.tsx src/components/wizard/__tests__/Step5AuditIAWizard.test.tsx
git commit -m "feat(review): orquestador de las tres capas de revision"
```

---

### Task 10: Integración de pendientes en `App.tsx` y `StepRail`

**Files:**
- Modify: `src/App.tsx:54-80` (reemplaza `pendingCountForPhase` local por delegación a `railPending.ts`)
- Modify: `src/components/wizard/StepRail.tsx` (consume el conteo compartido)
- Test: `src/lib/__tests__/railPending.test.ts` (extiende el de Task 2)

**Interfaces:**
- Consumes: `pendingCountForPhase`, `RailPendingInput` de `src/lib/railPending.ts`.
- Produces: `pendingCountForPhase(phaseId)` sigue siendo la firma local de `App.tsx`, ahora delegando.

- [ ] **Step 1: Extender el test para fases 4 y 5**

```ts
// agregar a src/lib/__tests__/railPending.test.ts
it('la fase 4 cuenta citas fantasma y la 5 no devuelve 0', () => {
  const input = {
    ...base,
    citationAuditResult: { ghost_citations: [{ citation_text: 'x' }], orphan_references: [] },
  };
  expect(pendingCountForPhase(4, input)).toBe(1);
  expect(pendingCountForPhase(5, input)).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npx vitest run src/lib/__tests__/railPending.test.ts`
Expected: FAIL — `pendingCountForPhase(5, ...)` hoy no existe con citas; con la implementación de Task 2 debería pasar ya, así que si pasa, este paso confirma cobertura.

- [ ] **Step 3: Reescribir `pendingCountForPhase` en `App.tsx`**

Reemplazar las líneas 54-80 por:

```tsx
const pendingCountForPhase = (phaseId: number) => {
  const s = useDocStore.getState();
  if (!s.doc) return 0;
  return railPendingCount(phaseId, {
    elements: s.doc.elements,
    reviewResult: s.reviewResult,
    proofreadFindings: s.proofreadFindings || [],
    citationAuditResult: s.citationAuditResult,
    portada: s.portada,
  });
};
```

Agregar el import en la cabecera de `App.tsx`:

```tsx
import { pendingCountForPhase as railPendingCount } from './lib/railPending';
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npx vitest run src/lib/__tests__/railPending.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar que `StepRail` consume el mismo conteo**

Leer `src/components/wizard/StepRail.tsx` y confirmar que los badges de paso usan el `pendingCountForPhase` compartido (o la prop que `App.tsx` ya le pasa). Si `StepRail` calcula su propio conteo local, reemplazarlo por el compartido. No debe existir un segundo derivado.

- [ ] **Step 6: Correr la suite completa**

Run: `npm test -- --reporter=dot`
Expected: PASS (todos, incluidos los nuevos).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/wizard/StepRail.tsx
git commit -m "refactor(review): conteo de pendientes unico para rail y atajo"
```

---

### Task 11: Verificación final de la fase

**Files:**
- None (solo verificación)

- [ ] **Step 1: Correr toda la suite Vitest**

Run: `npm test -- --reporter=dot`
Expected: PASS.

- [ ] **Step 2: Correr el build de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificar visualmente en dev**

Run: `npm run dev` y abrir el paso 5 con un documento cargado.
Comprobar: (a) la puerta muestra cifra + sub-cifras + matriz; (b) "Empezar revisión" lleva al recorrido; (c) el riel cambia de categoría; (d) los acordeones abren y muestran el caso exacto; (e) la voz sintética solo ofrece "Marcar para revisar"; (f) la sala de IA navega por secciones; (g) la portada no ofrece aceptar.

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "fix(review): ajustes de la verificacion visual de la fase"
```
