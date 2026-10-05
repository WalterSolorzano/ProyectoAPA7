/* WordAPA7 — AiHierarchy: Mapa y Dashboard Jerárquico de IA (H1 → H2 → H3).
 *
 * Muestra la radiografía integral de integridad del manuscrito:
 * 1. Macro Dashboard superior (Termómetro de Voz Autoral Humana vs Rigidez Sintética).
 * 2. Explorador capitular H1 con desglose H2/H3 y densidad de IA por sección.
 * 3. Split Inspector lado a lado: Texto Original con patrón LLM vs Propuesta de Autor Humano.
 * 4. Conexión segura con cerrojo de aplicación o copiado al portapapeles.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Flag,
  FolderTree,
  Layers,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { ElementModel } from '../../types';
import type { AuditItem } from '../../lib/auditItems';
import { construirJerarquia, type NodoJerarquia } from '../../lib/jerarquia';
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
  const [editedProposals, setEditedProposals] = useState<Record<string, string>>({});

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
  }, [elements, itemsByElemId]);

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

  const activeProposal = currentFinding
    ? editedProposals[currentFinding.id] ?? (currentFinding.suggestedText || currentFinding.originalText || '')
    : '';

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
    if (busy || !onApplyParaphrase) return;
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
          display: 'grid',
          gridTemplateColumns: '260px 1fr 280px',
          gap: 'var(--space-6)',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Termómetro de Integridad Global */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-full)',
              backgroundColor: humanIntegrityPct >= 80 ? 'var(--color-success-a12)' : 'var(--color-warning-a12)',
              border: `3px solid ${humanIntegrityPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 900,
                color: humanIntegrityPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
              }}
            >
              {humanIntegrityPct}%
            </span>
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Voz Autoral Humana
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              {syntheticPct}% rigidez sintética detectada
            </div>
          </div>
        </div>

        {/* Micro tarjetas de métricas macro */}
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-surface-alt)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--color-border-subtle)',
              flex: 1,
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Total Párrafos
            </span>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {totalParagraphsEstimated}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-success)' }}>
              {Math.max(0, totalParagraphsEstimated - flaggedParagraphsCount)} con autoría nítida
            </span>
          </div>

          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: flaggedParagraphsCount > 0 ? 'var(--color-danger-a08)' : 'var(--color-bg-surface-alt)',
              borderRadius: 'var(--radius-xs)',
              border: `1px solid ${flaggedParagraphsCount > 0 ? 'var(--color-danger-a12)' : 'var(--color-border-subtle)'}`,
              flex: 1,
            }}
          >
            <span style={{ fontSize: '10px', color: flaggedParagraphsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Párrafos en Alerta
            </span>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: flaggedParagraphsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {flaggedParagraphsCount}
            </div>
            <span style={{ fontSize: '10px', color: flaggedParagraphsCount > 0 ? 'var(--color-danger)' : 'var(--color-text-tertiary)' }}>
              Fórmulas LLM detectadas
            </span>
          </div>

          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--color-bg-surface-alt)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--color-border-subtle)',
              flex: 1,
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
              Pico Crítico
            </span>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-engine-ia)' }}>
              {criticalPeakChapter ? `${criticalPeakChapter.h1Number} (${criticalPeakChapter.iaScore}%)` : '—'}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {criticalPeakChapter?.title ?? 'Sin picos'}
            </span>
          </div>
        </div>

        {/* Criterio ético APA 7 */}
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg-surface-alt)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-xs)',
            lineHeight: 1.4,
          }}
        >
          <strong>Criterio APA 7:</strong> El motor probabilístico propone redacciones con voz de autor humano; jamás muta el documento a ciegas.
        </div>
      </section>

      {/* ── CUERPO JERÁRQUICO INFERIOR ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '440px minmax(0, 1fr)', minHeight: 0 }}>
        {/* SUB-PANEL IZQUIERDO: EXPLORADOR JERÁRQUICO */}
        <aside
          aria-label="Jerarquía Capitular"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderRight: '1px solid var(--color-border-subtle)',
            overflowY: 'auto',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Jerarquía Capitular
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Toca un nivel para desplegar
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {chapters.map((ch) => {
              const isH1Active = currentChapter?.id === ch.id;
              const barColor =
                ch.iaScore > 50
                  ? 'var(--color-danger)'
                  : ch.iaScore > 20
                    ? 'var(--color-warning)'
                    : 'var(--color-success)';

              return (
                <div
                  key={ch.id}
                  style={{
                    border: isH1Active ? '1px solid var(--color-engine-ia)' : '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    backgroundColor: isH1Active ? 'var(--color-engine-ia-a08)' : 'var(--color-bg-surface)',
                  }}
                >
                  {/* Fila del H1 */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isH1Active}
                    onClick={() => {
                      setSelectedH1Id(ch.id);
                      if (ch.subsections[0]) setSelectedSubId(ch.subsections[0].id);
                      if (ch.phase && onSelectPhase) onSelectPhase(ch.phase);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedH1Id(ch.id);
                        if (ch.subsections[0]) setSelectedSubId(ch.subsections[0].id);
                      }
                    }}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isH1Active ? 'var(--color-engine-ia-a12)' : 'var(--color-bg-surface)',
                      borderBottom: isH1Active ? '1px solid var(--color-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {isH1Active ? (
                        <ChevronDown size={15} style={{ color: 'var(--color-engine-ia)' }} />
                      ) : (
                        <ChevronRight size={15} style={{ color: 'var(--color-text-secondary)' }} />
                      )}
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          {ch.h1Number}: {ch.title}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                          {ch.words.toLocaleString()} palabras · {ch.flaggedCount} alertas
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 800,
                        color: barColor,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor:
                          ch.iaScore > 50
                            ? 'var(--color-danger-a12)'
                            : ch.iaScore > 20
                              ? 'var(--color-warning-a12)'
                              : 'var(--color-success-a12)',
                      }}
                    >
                      {ch.iaScore}% IA
                    </span>
                  </div>

                  {/* Subsecciones H2 / H3 */}
                  {isH1Active && ch.subsections.length > 0 && (
                    <div
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-1)',
                        backgroundColor: 'var(--color-bg-surface-alt)',
                      }}
                    >
                      {ch.subsections.map((sub) => {
                        const isSubActive = currentSub?.id === sub.id;
                        const subColor =
                          sub.iaScore > 50
                            ? 'var(--color-danger)'
                            : sub.iaScore > 20
                              ? 'var(--color-warning)'
                              : 'var(--color-success)';

                        return (
                          <div
                            key={sub.id}
                            role="button"
                            tabIndex={0}
                            aria-current={isSubActive ? 'true' : undefined}
                            onClick={() => setSelectedSubId(sub.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedSubId(sub.id);
                              }
                            }}
                            style={{
                              padding: '8px var(--space-3)',
                              borderRadius: 'var(--radius-xs)',
                              cursor: 'pointer',
                              backgroundColor: isSubActive ? 'var(--color-bg-surface)' : 'transparent',
                              border: isSubActive ? '1px solid var(--color-accent)' : '1px solid transparent',
                              boxShadow: isSubActive ? 'var(--shadow-sm)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ paddingLeft: sub.level === 'H3' ? 14 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    backgroundColor: 'var(--color-border-subtle)',
                                    padding: '1px 4px',
                                    borderRadius: 'var(--radius-xs)',
                                  }}
                                >
                                  {sub.level}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: isSubActive ? 700 : 500,
                                    color: 'var(--color-text-primary)',
                                  }}
                                >
                                  {sub.number} {sub.title}
                                </span>
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                                {sub.paragraphsCount} párrafos · {sub.flaggedCount} alertas
                              </div>
                            </div>

                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: subColor }}>
                              {sub.iaScore}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* SUB-PANEL DERECHO: INSPECTOR QUIRÚRGICO DE HALLAZGOS */}
        <section
          aria-label="Inspector de Alertas"
          style={{
            overflowY: 'auto',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {currentSub ? (
            <>
              {/* Cabecera de la subsección */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        color: 'var(--color-engine-ia)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {currentChapter?.h1Number} · {currentSub.level} {currentSub.number}
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: '4px 0 0',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 800,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {currentSub.title}
                  </h3>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 800,
                      color: currentSub.iaScore > 50 ? 'var(--color-danger)' : 'var(--color-warning)',
                      backgroundColor:
                        currentSub.iaScore > 50 ? 'var(--color-danger-a12)' : 'var(--color-warning-a12)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    Densidad de IA: {currentSub.iaScore}%
                  </span>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                    {currentSub.flaggedCount} párrafos en alerta
                  </div>
                </div>
              </div>

              {/* LISTA COMPACTA DE PÁRRAFOS SOSPECHOSOS */}
              {currentSub.findings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {/* Selector tipo pastillas */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 4 }}>
                    {currentSub.findings.map((finding, idx) => {
                      const isSel = (currentFinding?.id || '') === finding.id;
                      const isApp = appliedIds.includes(finding.id);

                      return (
                        <button
                          key={finding.id}
                          type="button"
                          onClick={() => setSelectedFindingId(finding.id)}
                          style={{
                            padding: '6px var(--space-3)',
                            borderRadius: 'var(--radius-xs)',
                            border: isSel
                              ? '1px solid var(--color-engine-ia)'
                              : '1px solid var(--color-border-subtle)',
                            backgroundColor: isSel ? 'var(--color-engine-ia)' : 'var(--color-bg-surface)',
                            color: isSel ? 'var(--color-text-on-accent)' : 'var(--color-text-primary)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>
                            Alerta {idx + 1}
                            {finding.pageNumber ? ` (Pág. ${finding.pageNumber})` : ''}
                          </span>
                          {isApp && (
                            <Check
                              size={12}
                              style={{ color: isSel ? 'var(--color-text-on-accent)' : 'var(--color-success)' }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* COMPARADOR SPLIT VIEW */}
                  {currentFinding && (
                    <div
                      style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          backgroundColor: 'var(--color-bg-surface-alt)',
                          borderBottom: '1px solid var(--color-border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <AlertCircle size={15} style={{ color: 'var(--color-danger)' }} />
                          <span
                            style={{
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {currentFinding.summary || 'Fórmula sintética / Muletilla LLM'}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontWeight: 800,
                            color: 'var(--color-danger)',
                            backgroundColor: 'var(--color-danger-a12)',
                            padding: '2px var(--space-2)',
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          Confianza: {currentFinding.aiScore ? `${Math.round(currentFinding.aiScore)}%` : 'Alta'}
                        </span>
                      </div>

                      {/* Cuadrícula Split: Texto Original vs Propuesta de Autor Humano */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          borderBottom: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        {/* Columna Izquierda: Original */}
                        <div
                          style={{
                            padding: 'var(--space-4)',
                            borderRight: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--color-danger)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Texto Original (Fórmula LLM Detectada)
                          </span>
                          <div
                            style={{
                              fontSize: '13.5px',
                              lineHeight: 1.75,
                              color: 'var(--color-text-primary)',
                              marginTop: 'var(--space-2)',
                            }}
                          >
                            <span
                              style={{
                                backgroundColor: 'var(--mark-ai-bg)',
                                borderBottom: '2px dashed var(--color-text-secondary)',
                                padding: '1px 2px',
                              }}
                            >
                              {currentFinding.originalText}
                            </span>
                          </div>
                          {currentFinding.detail && (
                            <div
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--color-text-tertiary)',
                                marginTop: 'var(--space-3)',
                                fontStyle: 'italic',
                              }}
                            >
                              {currentFinding.detail}
                            </div>
                          )}
                        </div>

                        {/* Columna Derecha: Propuesta Humana */}
                        <div
                          style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--color-success-a12)',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--color-success)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              Propuesta con Voz de Autor Humano
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                              Editable
                            </span>
                          </div>

                          <textarea
                            value={activeProposal}
                            onChange={(e) =>
                              setEditedProposals((prev) => ({
                                ...prev,
                                [currentFinding.id]: e.target.value,
                              }))
                            }
                            rows={5}
                            aria-label="Propuesta con Voz de Autor Humano"
                            style={{
                              marginTop: 'var(--space-2)',
                              width: '100%',
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: 'var(--radius-xs)',
                              border: '1px solid var(--color-border-subtle)',
                              backgroundColor: 'var(--color-bg-surface)',
                              color: 'var(--color-text-primary)',
                              fontFamily: 'inherit',
                              fontSize: '13px',
                              lineHeight: 1.6,
                              resize: 'vertical',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* Barra de Acciones del Inspector */}
                      <div
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          backgroundColor: 'var(--color-bg-surface-alt)',
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                        }}
                      >
                        {onOpenInWorkbench && (
                          <button
                            type="button"
                            onClick={() => onOpenInWorkbench(currentFinding)}
                            title="Abrir este hallazgo en la Mesa de Revisión por Lotes"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)',
                              padding: '6px var(--space-3)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)',
                              backgroundColor: 'var(--color-bg-surface)',
                              color: 'var(--color-text-primary)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginRight: 'auto',
                            }}
                          >
                            <Layers size={13} strokeWidth={1.75} aria-hidden />
                            Ver en Mesa
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(activeProposal, currentFinding.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)',
                            padding: '6px var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border-subtle)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Copy size={13} strokeWidth={1.75} aria-hidden />
                          {copiedId === currentFinding.id ? 'Copiado' : 'Copiar'}
                        </button>

                        {onMark && (
                          <button
                            type="button"
                            disabled={busy || markedIds.includes(currentFinding.id)}
                            onClick={() => onMark(currentFinding)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)',
                              padding: '6px var(--space-3)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)',
                              backgroundColor: 'var(--color-bg-surface)',
                              color: markedIds.includes(currentFinding.id)
                                ? 'var(--color-text-secondary)'
                                : 'var(--color-text-primary)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              cursor: busy || markedIds.includes(currentFinding.id) ? 'default' : 'pointer',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <Flag size={13} strokeWidth={1.75} aria-hidden />
                            {markedIds.includes(currentFinding.id)
                              ? 'Marcado para revisar'
                              : 'Marcar para revisar'}
                          </button>
                        )}

                        {onDismiss && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDismiss(currentFinding)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)',
                              padding: '6px var(--space-3)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-border-subtle)',
                              backgroundColor: 'var(--color-bg-surface)',
                              color: 'var(--color-text-primary)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              cursor: busy ? 'default' : 'pointer',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <X size={13} strokeWidth={1.75} aria-hidden />
                            Descartar
                          </button>
                        )}

                        {onApplyParaphrase && (
                          <button
                            type="button"
                            disabled={busy || appliedIds.includes(currentFinding.id) || !activeProposal.trim()}
                            onClick={() => handleApply(currentFinding, activeProposal)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)',
                              padding: '6px var(--space-4)',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              backgroundColor: appliedIds.includes(currentFinding.id)
                                ? 'var(--color-success)'
                                : 'var(--color-accent)',
                              color: 'var(--color-text-on-accent)',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                              cursor:
                                busy || appliedIds.includes(currentFinding.id) || !activeProposal.trim()
                                  ? 'default'
                                  : 'pointer',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            <Check size={13} strokeWidth={1.75} aria-hidden />
                            {appliedIds.includes(currentFinding.id)
                              ? 'Insertada en Manuscrito'
                              : 'Reemplazar en Manuscrito'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <EditorialMascot size={36} kind="highlighter" expression="happy" />
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    Esta subsección presenta autoría nítida
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    No se detectaron fórmulas sintéticas ni monotonía de perplejidad.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Selecciona un capítulo para inspeccionar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AiHierarchy;
