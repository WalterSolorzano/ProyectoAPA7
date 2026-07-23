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
    <div style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-color)',
      padding: '8px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      zIndex: 100
    }}>
      {/* Fila 1: Título del Paso Actual y Controles de Avanzar/Retroceder */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'var(--word-blue)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700
          }}>
            {wizardStep + 1}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--word-blue)' }}>
                {currentStepObj.title}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '10px' }}>
                {currentStepObj.desc}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Paso {wizardStep + 1} de {WIZARD_STEPS.length} — Acompañamiento APA 7 Activo
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
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 14px', fontSize: '12px', fontWeight: 600 }}
            >
              Aprobar y Siguiente <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => exportDocx(false)}
              disabled={isLoading}
              style={{ backgroundColor: '#15803d', borderColor: '#15803d', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 700 }}
            >
              <Download size={14} /> {isLoading ? 'Generando...' : 'DESCARGAR .DOCX APA 7'}
            </button>
          )}
        </div>
      </div>

      {/* Fila 2: Indicador Visual de Pasos (Timeline / Wizard Steps) */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
        {WIZARD_STEPS.map((step) => {
          const StepIcon = step.icon;
          const isActive = step.id === wizardStep;
          const isDone = step.id < wizardStep;

          return (
            <div
              key={step.id}
              onClick={() => setWizardStep(step.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: isActive ? '#eff6fc' : isDone ? '#f8fafc' : '#ffffff',
                border: `1px solid ${isActive ? 'var(--word-blue)' : isDone ? '#cbd5e1' : '#e2e8f0'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isDone ? (
                <CheckCircle2 size={13} color="#16a34a" />
              ) : (
                <StepIcon size={13} color={isActive ? 'var(--word-blue)' : '#94a3b8'} />
              )}
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--word-blue)' : isDone ? '#0f172a' : '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
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
          backgroundColor: 'var(--word-blue)',
          transition: 'width 0.25s ease'
        }} />
      </div>
    </div>
  );
};
