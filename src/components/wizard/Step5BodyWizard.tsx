/* WordAPA7 — Paso 5: Body Formatting Wizard (Sangría, Interlineado y Listas) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { AlignLeft, CheckCircle2, SpellCheck } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';
import { Badge } from '../ui/wordapa7';

const SPACING_OPTIONS = [
  { value: 2.0, label: 'Doble (APA)' },
  { value: 1.5, label: '1.5 líneas' },
  { value: 1.0, label: 'Sencillo' },
];

/** Fila compacta de una regla aplicada (resumen visual, sin párrafos largos). */
const RuleRow: React.FC<{ icon: React.ReactNode; label: string; value: string; badge: React.ReactNode }> = ({ icon, label, value, badge }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', flexShrink: 0, color: 'var(--text-secondary)' }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '1px' }}>{value}</span>
    </span>
    {badge}
  </div>
);

export const Step5BodyWizard: React.FC = () => {
  const { rules, setRules, doc, runAIReview, setForceRightPanelOpen, setRightPanelTab } = useDocStore();
  const [showPanel, setShowPanel] = useState(true);

  if (!doc) return null;

  const totalParagraphs = doc.elements.filter(e => e.type === 'paragraph').length;
  const totalLists = doc.elements.filter(e => e.type === 'numbered_list' || e.type === 'bullet').length;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>

      {showPanel ? (
      /* Panel Izquierdo: Reglas APA aplicadas */
      <div style={{
        width: '320px',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlignLeft size={16} /> Cuerpo del documento
          </h3>
          <Badge tone="accent">Párrafos, listas y sangrías</Badge>
          <button type="button" onClick={() => setShowPanel(false)} title="Colapsar panel de reglas"
            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 6px', fontSize: '12px' }}>✕</button>
        </div>

        <div style={{ padding: '14px', flex: 1, overflowY: 'auto', display: 'grid', gap: '12px' }}>

          {/* Resumen compacto de reglas aplicadas */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <CheckCircle2 size={13} color="var(--color-success)" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Reglas aplicadas</span>
              <div style={{ flex: 1 }} />
              <Badge tone="success">Auto</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <RuleRow icon={<AlignLeft size={13} />} label="Sangría primera línea" value={`1.27 cm · ${totalParagraphs} párrafos`} badge={<Badge tone="muted">Fijo</Badge>} />
              <RuleRow icon={<AlignLeft size={13} />} label="Enumeración de listas" value={`${totalLists} listas secuenciales`} badge={<Badge tone="muted">Fijo</Badge>} />
              <RuleRow icon={<AlignLeft size={13} />} label="Márgenes y tipografía" value={`2.54 cm · ${rules.font_family} ${rules.font_size_pt}pt`} badge={<Badge tone="muted">Fijo</Badge>} />
            </div>
          </div>

          {/* Interlineado (configurable) */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-elevated)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>Interlineado</span>
              <Badge tone="accent">Configurable</Badge>
            </div>
            <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {SPACING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="ribbon-tab"
                  style={{
                    padding: '7px 6px', fontSize: '11px', borderRadius: '8px',
                    border: rules.line_spacing === opt.value ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    background: rules.line_spacing === opt.value ? 'rgba(79,124,255,0.12)' : 'rgba(255,255,255,0.03)',
                    color: rules.line_spacing === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: rules.line_spacing === opt.value ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => setRules({ line_spacing: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ padding: '0 12px 10px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El doble (2.0) es el estándar APA 7, pero podés ajustarlo si tu institución lo pide.
            </div>
          </div>

          {/* Revisión ortográfica + IA */}
          <div style={{
            padding: '12px', border: '1px solid rgba(79,124,255,0.35)', borderRadius: 'var(--radius-lg)',
            backgroundColor: 'rgba(79,124,255,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Revisión ortográfica e IA</strong>
              <Badge tone="success">Disponible</Badge>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
              Ortografía, gramática y detección de texto generado por IA. El resultado aparece en el panel Actividad.
            </p>
            <button
              type="button"
              onClick={async () => {
                await runAIReview();
                setForceRightPanelOpen(true);
                setRightPanelTab('activity');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', width: '100%',
                justifyContent: 'center', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
                background: 'var(--word-blue)', color: '#fff',
                border: 'none',
              }}
            >
              <SpellCheck size={14} /> Abrir Revisor
            </button>
          </div>
        </div>
      </div>
      ) : (
        <div style={{
          width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)', paddingTop: 8,
        }}>
          <button type="button" onClick={() => setShowPanel(true)}
            title="Mostrar panel de reglas del cuerpo"
            style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(79,124,255,0.10)', border: '1px solid rgba(79,124,255,0.2)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlignLeft size={14} />
          </button>
        </div>
      )}

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', backgroundColor: 'var(--canvas-bg)', position: 'relative' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

export default Step5BodyWizard;
