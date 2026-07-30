/* WordAPA7 — Guided Wizard Bar Component (Barra de Navegación por Pasos con Acompañamiento) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Download, Layout, Type, Image, Table, AlignLeft, BookOpen } from 'lucide-react';

export const WIZARD_STEPS = [
  { id: 0, title: 'Preferencias', icon: Type, desc: 'Fuente y Estilo' },
  { id: 1, title: '1. Portada', icon: Layout, desc: 'Antes vs Arreglado' },
  { id: 2, title: '2. Títulos', icon: Type, desc: 'Jerarquía 1, 2, 3' },
  { id: 3, title: '3. Figuras', icon: Image, desc: 'Etiquetas APA' },
  { id: 4, title: '4. Tablas', icon: Table, desc: 'Bordes APA' },
  { id: 5, title: '5. Cuerpo', icon: AlignLeft, desc: 'Sangría y Listas' },
  { id: 6, title: '6. Descarga', icon: Download, desc: 'Exportar DOCX' },
];

export const GuidedWizardBar: React.FC = () => {
  const { wizardStep, setWizardStep, exportDocx, isLoading } = useDocStore();

  const currentStepObj = WIZARD_STEPS.find(s => s.id === wizardStep) || WIZARD_STEPS[0];
  const progressPct = Math.round(((wizardStep + 1) / WIZARD_STEPS.length) * 100);

  const handleNext = () => {
    if (wizardStep < WIZARD_STEPS.length - 1) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handlePrev = () => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  };

  return (
    <div className="guided-wizard-bar" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      padding: '4px 8px'
    }}>
      <div className="guided-wizard-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                {currentStepObj.title}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                {currentStepObj.desc}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Paso {wizardStep + 1} de {WIZARD_STEPS.length}
            </span>
          </div>
        </div>

        {/* Acciones del Asistente */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {wizardStep > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePrev}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px' }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
          )}

          {wizardStep < WIZARD_STEPS.length - 1 ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleNext}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px' }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', padding: '4px 10px', backgroundColor: '#f0fdf4', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
              Paso Final de Exportacion
            </span>
          )}
        </div>
      </div>

      {/* Fila 2: Indicador Visual de Pasos (Timeline / Wizard Steps) */}
      <div className="guided-wizard-steps" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
        {WIZARD_STEPS.map((step) => {
          const isActive = step.id === wizardStep;
          const isDone = step.id < wizardStep;

          return (
            <div
              key={step.id}
              className={`guided-wizard-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
              onClick={() => setWizardStep(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: isDone ? 'var(--accent-secondary)' : isActive ? 'var(--accent-primary)' : 'transparent',
                boxShadow: isActive ? '0 0 8px rgba(124,92,252,0.6)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive || isDone ? '#ffffff' : 'var(--text-muted)',
                whiteSpace: 'nowrap'
              }}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Barra de Progreso General */}
      <div style={{ width: '100%', height: '3px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${progressPct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
          transition: 'width 0.25s ease'
        }} />
      </div>

    </div>
  );
};
