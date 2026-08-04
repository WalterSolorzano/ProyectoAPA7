/* WordAPA7 — Paso 5: Body Formatting Wizard (Sangría, Interlineado y Listas) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { AlignLeft, Lock, CheckCircle2, SpellCheck } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';
import { Badge } from '../ui/wordapa7';

const SPACING_OPTIONS = [
  { value: 2.0, label: 'Doble (APA)' },
  { value: 1.5, label: '1.5 líneas' },
  { value: 1.0, label: 'Sencillo' },
];

export const Step5BodyWizard: React.FC = () => {
  const { rules, setRules, doc, runAIReview, setForceRightPanelOpen, setRightPanelTab } = useDocStore();

  if (!doc) return null;

  const totalParagraphs = doc.elements.filter(e => e.type === 'paragraph').length;
  const totalLists = doc.elements.filter(e => e.type === 'numbered_list' || e.type === 'bullet').length;

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Panel Izquierdo: Reglas APA aplicadas */}
      <div style={{
        width: '380px',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlignLeft size={16} /> Paso 5: Cuerpo del documento
          </h3>
          <Badge tone="accent">Párrafos, listas y sangrías</Badge>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'grid', gap: '14px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Regla 1: Sangría de Primera Línea */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Sangría de primera línea</strong>
                  <Lock size={12} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                </div>
                <Badge tone="muted">Fijo (APA 7)</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Sangría francesa 1.27 cm aplicada automáticamente a los {totalParagraphs} párrafos del cuerpo. Es un valor fijo de la norma, no editable.
              </p>
            </div>

            {/* Regla 2: Interlineado General */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Interlineado general</strong>
                </div>
                <Badge tone="accent">Configurable</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
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
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                El interlineado doble (2.0) es el estándar APA 7, pero puedes ajustarlo si tu institución lo pide.
              </p>
            </div>

            {/* Regla 3: Enumeración de Listas */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Enumeración de listas</strong>
                  <Lock size={12} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                </div>
                <Badge tone="muted">Fijo (APA 7)</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                {totalLists} elementos de lista enumerados de forma secuencial (1., 2., 3.) sin reinicios falsos.
              </p>
            </div>

            {/* Regla 4: Márgenes */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Márgenes y tipografía</strong>
                  <Lock size={12} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                </div>
                <Badge tone="muted">Fijo (APA 7)</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Márgenes de 2.54 cm en los 4 lados y {rules.font_family} {rules.font_size_pt}pt en todo el cuerpo.
              </p>
            </div>

            {/* Revisión ortográfica + IA */}
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(79,124,255,0.06)', borderLeft: '3px solid var(--word-blue)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Revisión ortográfica e IA</strong>
                <Badge tone="success">Disponible</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                Revisa ortografía, gramática y detección de texto generado por IA. El resultado aparece en el panel Actividad.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await runAIReview();
                  setForceRightPanelOpen(true);
                  setRightPanelTab('activity');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px',
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
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
      </div>

      {/* Panel Derecho: Lienzo Sincronizado */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', backgroundColor: 'var(--canvas-bg)', position: 'relative' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

export default Step5BodyWizard;
