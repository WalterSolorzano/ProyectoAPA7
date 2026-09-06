import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  ListTree,
  Image as ImageIcon,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';

export const APAScoreCard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const doc = useDocStore((s) => s.doc);
  const portada = useDocStore((s) => s.portada);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  const setWizardStep = useDocStore((s) => s.setWizardStep);

  const stats = useMemo(() => {
    if (!doc || !doc.elements) {
      return { score: 100, items: [], warnings: [] };
    }

    const elements = doc.elements;
    const headings = elements.filter((e) => e.type === 'heading');
    const figures = elements.filter((e) => e.type === 'image');
    const tables = elements.filter((e) => e.type === 'table');
    const paragraphs = elements.filter((e) => e.type === 'paragraph');
    const refs = doc.referencias || [];

    const unreviewedHeadings = headings.filter((e) => e.needs_review);
    const unreviewedFigures = figures.filter((e) => e.needs_review);
    const unreviewedTables = tables.filter((e) => e.needs_review);

    const warnings: Array<{ id: string; label: string; elementId?: string; step: number }> = [];

    unreviewedHeadings.forEach((h) => {
      warnings.push({
        id: `h_${h.id}`,
        label: `Título sin confirmar: "${(h.text || '').slice(0, 30)}..."`,
        elementId: h.id,
        step: 2,
      });
    });

    unreviewedFigures.forEach((f) => {
      warnings.push({
        id: `f_${f.id}`,
        label: `Figura sin leyenda APA 7 confirmada`,
        elementId: f.id,
        step: 3,
      });
    });

    unreviewedTables.forEach((t) => {
      warnings.push({
        id: `t_${t.id}`,
        label: `Tabla sin estilo APA 7 confirmado`,
        elementId: t.id,
        step: 3,
      });
    });

    // Cálculo ponderado de cumplimiento (0 a 100)
    let score = 100;
    if (warnings.length > 0) {
      score = Math.max(65, 100 - warnings.length * 5);
    }

    const items = [
      {
        title: 'Portada',
        status: portada.use_original_cover || (portada.title && portada.author) ? 'ok' : 'warn',
        detail: portada.use_original_cover ? 'Original protegida' : 'Formato APA 7 Estudiante',
        icon: FileText,
        step: 1,
      },
      {
        title: 'Estructura & Títulos',
        status: unreviewedHeadings.length === 0 ? 'ok' : 'warn',
        detail: `${headings.length} títulos detectados (${unreviewedHeadings.length} pendientes)`,
        icon: ListTree,
        step: 2,
      },
      {
        title: 'Tablas & Figuras',
        status: unreviewedFigures.length === 0 && unreviewedTables.length === 0 ? 'ok' : 'warn',
        detail: `${tables.length} tablas, ${figures.length} figuras`,
        icon: ImageIcon,
        step: 3,
      },
      {
        title: 'Referencias',
        status: refs.length > 0 ? 'ok' : 'info',
        detail: `${refs.length} fuentes bibliográficas`,
        icon: BookOpen,
        step: 4,
      },
    ];

    return { score, items, warnings };
  }, [doc, portada]);

  if (!doc) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--accent-success, #10b981)';
    if (score >= 75) return 'var(--accent-primary, #4f7cff)';
    return 'var(--accent-warning, #f59e0b)';
  };

  const handleJumpToWarning = (elementId?: string, step: number = 2) => {
    setWizardStep(step);
    if (elementId) {
      setSelectedElementId(elementId);
      setScrollTargetId(elementId);
    }
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botón Chip de Conformidad APA 7 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Diagnóstico de Conformidad APA 7"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          border: `1px solid ${getScoreColor(stats.score)}`,
          backgroundColor: 'var(--surface-elevated, #ffffff)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-main, #1a1a2e)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
          transition: 'all 0.15s ease',
        }}
      >
        <ShieldCheck size={14} color={getScoreColor(stats.score)} />
        <span>APA 7: <strong style={{ color: getScoreColor(stats.score) }}>{stats.score}%</strong></span>
        {stats.warnings.length > 0 ? (
          <span
            style={{
              backgroundColor: 'var(--accent-warning, #f59e0b)',
              color: '#ffffff',
              borderRadius: '999px',
              padding: '1px 5px',
              fontSize: '9px',
              fontWeight: 800,
            }}
          >
            {stats.warnings.length}
          </span>
        ) : (
          <CheckCircle size={12} color="var(--accent-success, #10b981)" />
        )}
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Popover / Tarjeta de Diagnóstico */}
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '320px',
              backgroundColor: 'var(--surface-elevated, #ffffff)',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-card, 0 10px 25px rgba(0,0,0,0.15))',
              padding: '16px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Encabezado del Diagnóstico */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle, #e5e7eb)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="var(--accent-primary, #4f7cff)" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main, #1a1a2e)' }}>Diagnóstico APA 7</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 900, color: getScoreColor(stats.score) }}>
                {stats.score}%
              </span>
            </div>

            {/* Desglose de Secciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleJumpToWarning(undefined, item.step)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: '1px solid transparent',
                      backgroundColor: 'var(--surface-subtle, #f9fafb)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent-soft, #eef2ff)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle, #f9fafb)')}
                  >
                    <Icon size={14} color="var(--accent-primary, #4f7cff)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #1a1a2e)' }}>{item.title}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary, #6b7280)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.detail}
                      </div>
                    </div>
                    {item.status === 'ok' ? (
                      <CheckCircle size={13} color="var(--accent-success, #10b981)" style={{ flexShrink: 0 }} />
                    ) : (
                      <AlertTriangle size={13} color="var(--accent-warning, #f59e0b)" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Lista de Advertencias con salto directo */}
            {stats.warnings.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle, #e5e7eb)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-warning, #f59e0b)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Avisos para revisión ({stats.warnings.length})
                </div>
                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {stats.warnings.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleJumpToWarning(w.elementId, w.step)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-main, #1a1a2e)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-subtle, #f3f4f6)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, paddingRight: '6px' }}>
                        {w.label}
                      </span>
                      <ArrowUpRight size={12} color="var(--accent-primary, #4f7cff)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
