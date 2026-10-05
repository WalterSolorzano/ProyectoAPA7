/* WordAPA7 — AiHierarchy: Mapa y Dashboard Jerárquico de IA (H1 → H2 → H3).
 *
 * Muestra la radiografía integral de integridad del manuscrito:
 * 1. Macro Dashboard superior (Termómetro de Voz Autoral Humana vs Rigidez Sintética).
 * 2. Explorador capitular H1 con desglose H2/H3 y densidad de IA por sección.
 * 3. Split Inspector lado a lado: Texto Original con patrón LLM vs Propuesta de Autor Humano.
 * 4. Conexión segura con cerrojo de aplicación o copiado al portapapeles.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Flag,
  Layers,
  X,
} from 'lucide-react';
import type { ElementModel } from '../../types';
import type { AuditItem } from '../../lib/auditItems';
import { construirJerarquia, type NodoJerarquia } from '../../lib/jerarquia';
import { construirHeatmap } from '../../lib/aiHeatmap';
import { AiHeatmap } from './AiHeatmap';
import { AiChapterGrid } from './AiChapterGrid';
import { AiChapterFocus } from './AiChapterFocus';
import { EditorialMascot } from '../layout/EditorialMascot';

export interface AiHierarchyProps {
  elements: readonly ElementModel[] | null;
  items: readonly AuditItem[];
  activa?: string | 'all';
  onSelectPhase?: (phaseKey: string) => void;
  onOpenInWorkbench?: (item: AuditItem) => void;
  onApplyParaphrase?: (item: AuditItem, newText: string) => Promise<void>;
  onMark?: (item: AuditItem) => void;
  onDismiss?: (item: AuditItem) => void;
  markedIds?: readonly string[];
  busy?: boolean;
}

interface ChapterViewData {
  id: string;
  h1Number: string;
  title: string;
  phase: string | null;
  elementId: string | null;
  words: number;
  iaScore: number;
  flaggedCount: number;
  subsections: {
    id: string;
    level: 'H2' | 'H3';
    number: string;
    title: string;
    elementId: string | null;
    iaScore: number;
    paragraphsCount: number;
    flaggedCount: number;
    findings: AuditItem[];
  }[];
}

export function AiHierarchy({
  elements,
  items,
  activa,
  onSelectPhase,
  onOpenInWorkbench,
  onApplyParaphrase,
  onMark,
  onDismiss,
  markedIds = [],
  busy = false,
}: AiHierarchyProps) {
  const [selectedH1Id, setSelectedH1Id] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [capAbierto, setCapAbierto] = useState<string | null>(null);
  const proposalRef = useRef<HTMLTextAreaElement>(null);

  // Filtrar hallazgos de categoría 'ai'
  const aiItems = useMemo(() => items.filter((it) => it.category === 'ai'), [items]);

  // Mapa de hallazgos por element_id
  const itemsByElemId = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    for (const it of aiItems) {
      if (it.element_id) {
        const list = map.get(it.element_id) ?? [];
        list.push(it);
        map.set(it.element_id, list);
      }
    }
    return map;
  }, [aiItems]);

  // Construir jerarquía real del documento y mapear elementos a su sección
  const chapters = useMemo<ChapterViewData[]>(() => {
    if (!elements || elements.length === 0) return [];

    // Mapeo secuencial de element_id a su H1 y H2/H3 activo
    const elemToLocation = new Map<string, { h1Id: string; subId: string }>();
    let curH1: string | null = null;
    let curSub: string | null = null;

    for (const el of elements) {
      if (el.type === 'heading') {
        const lvl = Math.max(1, el.heading_level ?? 1);
        if (lvl === 1) {
          curH1 = el.id;
          curSub = `${el.id}-general`;
        } else if (lvl >= 2 && curH1) {
          curSub = el.id;
        }
      }
      if (curH1) {
        elemToLocation.set(el.id, { h1Id: curH1, subId: curSub ?? `${curH1}-general` });
      }
    }

    const arbol: NodoJerarquia[] = construirJerarquia(elements);

    return arbol.map((h1Node, h1Idx) => {
      // Recolectar subsecciones H2 y H3
      const subs: ChapterViewData['subsections'] = [];

      let totalParas = 0;
      let chapterAiItems: AuditItem[] = [];

      // Si el nodo H1 tiene hijos
      if (h1Node.hijos && h1Node.hijos.length > 0) {
        // Párrafos antes del primer H2
        const preH2Findings = aiItems.filter(
          (it) => elemToLocation.get(it.element_id)?.subId === `${h1Node.id}-general`,
        );
        if (preH2Findings.length > 0) {
          subs.push({
            id: `${h1Node.id}-general`,
            level: 'H2',
            number: `${h1Idx + 1}.0`,
            title: 'Introducción del Capítulo',
            elementId: h1Node.elementoId,
            iaScore: Math.min(95, preH2Findings.length * 25),
            paragraphsCount: Math.max(1, preH2Findings.length),
            flaggedCount: preH2Findings.length,
            findings: preH2Findings,
          });
          chapterAiItems.push(...preH2Findings);
          totalParas += Math.max(1, preH2Findings.length);
        }

        h1Node.hijos.forEach((h2Node, h2Idx) => {
          // Párrafos bajo H2
          const h2Findings = aiItems.filter(
            (it) =>
              elemToLocation.get(it.element_id)?.subId === h2Node.id ||
              it.element_id === h2Node.elementoId,
          );

          subs.push({
            id: h2Node.id,
            level: 'H2',
            number: `${h1Idx + 1}.${h2Idx + 1}`,
            title: h2Node.titulo || `Subsección ${h1Idx + 1}.${h2Idx + 1}`,
            elementId: h2Node.elementoId,
            iaScore: h2Findings.length > 0 ? Math.min(95, h2Findings.length * 25) : 0,
            paragraphsCount: Math.max(1, Math.round(h2Node.palabras / 120)),
            flaggedCount: h2Findings.length,
            findings: h2Findings,
          });

          chapterAiItems.push(...h2Findings);
          totalParas += Math.max(1, Math.round(h2Node.palabras / 120));

          // H3 bajo H2
          if (h2Node.hijos && h2Node.hijos.length > 0) {
            h2Node.hijos.forEach((h3Node, h3Idx) => {
              const h3Findings = aiItems.filter(
                (it) =>
                  elemToLocation.get(it.element_id)?.subId === h3Node.id ||
                  it.element_id === h3Node.elementoId,
              );

              subs.push({
                id: h3Node.id,
                level: 'H3',
                number: `${h1Idx + 1}.${h2Idx + 1}.${h3Idx + 1}`,
                title: h3Node.titulo || `Apartado ${h1Idx + 1}.${h2Idx + 1}.${h3Idx + 1}`,
                elementId: h3Node.elementoId,
                iaScore: h3Findings.length > 0 ? Math.min(95, h3Findings.length * 28) : 0,
                paragraphsCount: Math.max(1, Math.round(h3Node.palabras / 120)),
                flaggedCount: h3Findings.length,
                findings: h3Findings,
              });

              chapterAiItems.push(...h3Findings);
              totalParas += Math.max(1, Math.round(h3Node.palabras / 120));
            });
          }
        });
      } else {
        // Capítulo sin subtítulos: todos los párrafos que cuelgan del H1
        const generalFindings = aiItems.filter(
          (it) =>
            elemToLocation.get(it.element_id)?.h1Id === h1Node.id ||
            it.element_id === h1Node.elementoId,
        );
        subs.push({
          id: `${h1Node.id}-general`,
          level: 'H2',
          number: `${h1Idx + 1}.1`,
          title: 'Contenido General',
          elementId: h1Node.elementoId,
          iaScore: generalFindings.length > 0 ? Math.min(90, generalFindings.length * 30) : 0,
          paragraphsCount: Math.max(1, Math.round(h1Node.palabras / 120)),
          flaggedCount: generalFindings.length,
          findings: generalFindings,
        });
        chapterAiItems.push(...generalFindings);
        totalParas += Math.max(1, Math.round(h1Node.palabras / 120));
      }

      const chapterIaScore =
        totalParas > 0
          ? Math.min(100, Math.round((chapterAiItems.length / totalParas) * 100))
          : chapterAiItems.length > 0
            ? 35
            : 0;

      return {
        id: h1Node.id,
        h1Number: `Capítulo ${h1Idx + 1}`,
        title: h1Node.titulo || `Capítulo ${h1Idx + 1}`,
        phase: h1Node.fase,
        elementId: h1Node.elementoId,
        words: h1Node.palabras,
        iaScore: chapterIaScore,
        flaggedCount: chapterAiItems.length,
        subsections: subs,
      };
    });
  }, [elements, itemsByElemId, aiItems]);

  // Mapa de calor H1 × rango de índice IA (mismo motor que alimenta el hero)
  const { filas: heatFila, max: heatMax } = useMemo(
    () =>
      construirHeatmap(
        chapters.map((c) => ({
          id: c.id,
          titulo: c.title,
          findings: c.subsections.flatMap((s) => s.findings),
        })),
      ),
    [chapters],
  );

  // Selección activa
  const effectiveH1Id = selectedH1Id || chapters[0]?.id || '';
  const currentChapter = chapters.find((c) => c.id === effectiveH1Id) || chapters[0];

  const effectiveSubId =
    selectedSubId || (currentChapter?.subsections[0]?.id ?? '');
  const currentSub =
    currentChapter?.subsections.find((s) => s.id === effectiveSubId) ||
    currentChapter?.subsections[0];

  const currentFinding =
    currentSub?.findings.find((f) => f.id === selectedFindingId) ||
    currentSub?.findings[0] ||
    currentChapter?.subsections.flatMap((s) => s.findings)[0];

  // Métricas macro
  const totalParagraphsEstimated = useMemo(() => {
    if (!elements) return 0;
    return elements.filter((e) => e.type === 'paragraph' || e.type === 'block_quote').length || 1;
  }, [elements]);

  const flaggedParagraphsCount = aiItems.length;
  const humanIntegrityPct =
    totalParagraphsEstimated > 0
      ? Math.max(0, Math.min(100, Math.round(((totalParagraphsEstimated - flaggedParagraphsCount) / totalParagraphsEstimated) * 100)))
      : 100;
  const syntheticPct = 100 - humanIntegrityPct;

  const criticalPeakChapter = useMemo(() => {
    if (!chapters.length) return null;
    let maxChap = chapters[0];
    for (const ch of chapters) {
      if (ch.iaScore > maxChap.iaScore) maxChap = ch;
    }
    return maxChap;
  }, [chapters]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleApply = async (finding: AuditItem, proposal: string) => {
    if (busy || !onApplyParaphrase || !proposal.trim()) return;
    await onApplyParaphrase(finding, proposal);
    setAppliedIds((prev) => [...prev, finding.id]);
  };

  if (!elements || elements.length === 0) {
    return (
      <div
        role="status"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-canvas)',
        }}
      >
        <EditorialMascot size={48} kind="highlighter" expression="curious" />
        <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Sin documento cargado
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: '44ch' }}>
          Abre un documento para inspeccionar la integridad autoral y la jerarquía de detección de IA.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        backgroundColor: 'var(--color-bg-canvas)',
      }}
    >
      {/* ── MACRO DASHBOARD SUPERIOR ── */}
      <section
        aria-label="Dashboard de Integridad Autoral"
        style={{
          padding: 'var(--space-4) var(--space-6)',
          backgroundColor: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          flexShrink: 0,
        }}
      >
        {/* Voz autoral: cifra y contexto, sin anillo */}
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-2) var(--space-4)' }}>
          <span
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 800,
              lineHeight: 1,
              color: humanIntegrityPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
            }}
          >
            {humanIntegrityPct}%
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Voz Autoral Humana
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {syntheticPct}% rigidez sintética detectada
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {totalParagraphsEstimated} párrafos ·{' '}
            {Math.max(0, totalParagraphsEstimated - flaggedParagraphsCount)} con autoría nítida
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: flaggedParagraphsCount > 0 ? 700 : 400,
              color: flaggedParagraphsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)',
            }}
          >
            {flaggedParagraphsCount} <span>Párrafos en Alerta</span>
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Pico crítico:{' '}
            {criticalPeakChapter
              ? `${criticalPeakChapter.h1Number} (${criticalPeakChapter.iaScore}%)`
              : 'sin picos'}
          </span>
        </div>

        {/* Mapa de calor H1 × rango */}
        <AiHeatmap filas={heatFila} max={heatMax} />

        {/* Criterio ético APA 7 */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
          <strong>Criterio APA 7:</strong> El motor probabilístico propone redacciones con voz de autor humano; jamás muta el documento a ciegas.
        </div>
      </section>

      {/* ── CUERPO: rectángulos de capítulo o vista aislada del capítulo ── */}
      {capAbierto ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
          <AiChapterFocus
            titulo={chapters.find((c) => c.id === capAbierto)?.title ?? ''}
            findings={
              chapters.find((c) => c.id === capAbierto)?.subsections.flatMap((s) => s.findings) ?? []
            }
            onMark={onMark}
            onDismiss={onDismiss}
            onApplyParaphrase={onApplyParaphrase}
            busy={busy}
            onBack={() => setCapAbierto(null)}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
          <AiChapterGrid
            chapters={chapters.map((c) => ({
              id: c.id,
              titulo: c.title,
              findings: c.subsections.flatMap((s) => s.findings),
            }))}
            onOpen={setCapAbierto}
          />
        </div>
      )}

    </div>
  );
}

export default AiHierarchy;
