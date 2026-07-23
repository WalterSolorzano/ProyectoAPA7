/* WordAPA7 — Wizard de Configuración (3 pasos antes del upload) */

import React, { useState } from 'react';
import { useDocStore } from '../store/useDocStore';
import { APAFormat, WizardCoverPage, WorkMode } from '../types';
import { GraduationCap, Building2, FileText, Upload, Eye, Zap, FileCheck, Check } from 'lucide-react';

interface WizardStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  showBack?: boolean;
}

const WizardStep: React.FC<WizardStepProps> = ({
  stepNumber,
  totalSteps,
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Siguiente',
  showBack = false,
}) => (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '48px 64px',
    maxWidth: '680px',
    margin: '0 auto',
    width: '100%',
  }}>
    {/* Progress indicator */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: '4px',
            borderRadius: '2px',
            backgroundColor: i < stepNumber ? 'var(--accent)' : 'var(--border-default)',
            transition: 'background-color 0.3s ease',
          }}
        />
      ))}
    </div>

    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
      Paso {stepNumber} de {totalSteps}
    </p>
    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{title}</h2>
    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: 1.5 }}>
      {description}
    </p>

    <div style={{ flex: 1 }}>{children}</div>

    <div style={{
      display: 'flex',
      justifyContent: showBack ? 'space-between' : 'flex-end',
      marginTop: '32px',
      paddingTop: '24px',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      {showBack && onBack && (
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '10px 24px', fontSize: '14px' }}
        >
          Atrás
        </button>
      )}
      <button
        onClick={onNext}
        className="btn btn-primary"
        style={{ padding: '10px 24px', fontSize: '14px' }}
      >
        {nextLabel}
      </button>
    </div>
  </div>
);

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: string[];
}

const OptionCard: React.FC<OptionCardProps> = ({ selected, onClick, icon, title, description, details }) => (
  <div
    onClick={onClick}
    style={{
      padding: '20px',
      borderRadius: '10px',
      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-default)'}`,
      backgroundColor: selected ? 'var(--accent-subtle)' : 'var(--bg-base)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      marginBottom: '12px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: selected ? 'var(--accent)' : 'var(--bg-layer)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: selected ? '#ffffff' : 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
        {details && details.length > 0 && (
          <ul style={{ marginTop: '12px', paddingLeft: '18px' }}>
            {details.map((d, i) => (
              <li key={i} style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '4px',
      }}>
        {selected && (
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
        )}
      </div>
    </div>
  </div>
);

export const Wizard: React.FC = () => {
  const { setWizardComplete, resetWizard } = useDocStore();

  const [step, setStep] = useState(1);
  const [apaFormat, setApaFormat] = useState<APAFormat>('student');
  const [coverPage, setCoverPage] = useState<WizardCoverPage>('use_existing');
  const [workMode, setWorkMode] = useState<WorkMode>('review');

  const handleComplete = () => {
    setWizardComplete({
      apa_format: apaFormat,
      cover_page: coverPage,
      work_mode: workMode,
    });
  };

  const handleBack = () => {
    if (step === 1) {
      resetWizard();
      return;
    }
    setStep((s) => s - 1);
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text-primary)',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        backgroundColor: 'var(--bg-layer)',
        borderRight: '1px solid var(--border-subtle)',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}>
            <FileText size={18} />
          </div>
          <h1 style={{ fontSize: '15px', fontWeight: 700 }}>WordAPA7</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { num: 1, label: 'Formato APA', active: step === 1, done: step > 1 },
            { num: 2, label: 'Portada', active: step === 2, done: step > 2 },
            { num: 3, label: 'Modo de trabajo', active: step === 3, done: false },
          ].map((item) => (
            <div
              key={item.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: item.active ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: item.done ? 'var(--status-green)' : item.active ? 'var(--accent)' : 'var(--bg-base)',
                border: item.done || item.active ? 'none' : '2px solid var(--border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {item.done ? <Check size={12} strokeWidth={3} /> : item.num}
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: item.active ? 600 : 400,
                color: item.active ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      {step === 1 && (
        <WizardStep
          stepNumber={1}
          totalSteps={3}
          title="Tipo de trabajo"
          description="Esto determina el formato de portada, encabezado y estructura del documento segun APA 7."
          onNext={() => setStep(2)}
          onBack={handleBack}
          showBack={true}
        >
          <OptionCard
            selected={apaFormat === 'student'}
            onClick={() => setApaFormat('student')}
            icon={<GraduationCap size={20} />}
            title="Formato Estudiante"
            description="Para tareas universitarias, ensayos y trabajos de grado."
            details={[
              'Portada sin running head',
              'Solo numero de pagina en encabezado',
              'No lleva nota de autor',
              'Incluye datos del curso e instructor',
            ]}
          />
          <OptionCard
            selected={apaFormat === 'professional'}
            onClick={() => setApaFormat('professional')}
            icon={<Building2 size={20} />}
            title="Formato Profesional / Publicacion"
            description="Para articulos de investigacion y publicaciones cientificas."
            details={[
              'Running head en todas las paginas',
              'Nota de autor en la portada',
              'Formato de revista academica',
              'Encabezado con titulo corto en mayusculas',
            ]}
          />
        </WizardStep>
      )}

      {step === 2 && (
        <WizardStep
          stepNumber={2}
          totalSteps={3}
          title="Manejo de portada"
          description="Elige como quieres que el sistema maneje la portada de tu documento."
          onNext={() => setStep(3)}
          onBack={handleBack}
          showBack={true}
        >
          <OptionCard
            selected={coverPage === 'use_existing'}
            onClick={() => setCoverPage('use_existing')}
            icon={<FileText size={20} />}
            title="Usar portada existente"
            description="El sistema detectara y preservara la portada que ya tienes en el documento."
          />
          <OptionCard
            selected={coverPage === 'import_saved'}
            onClick={() => setCoverPage('import_saved')}
            icon={<Upload size={20} />}
            title="Importar una portada guardada"
            description="Selecciona una portada de tu coleccion de plantillas guardadas."
          />
          <OptionCard
            selected={coverPage === 'none'}
            onClick={() => setCoverPage('none')}
            icon={<Eye size={20} />}
            title="No necesito portada"
            description="El sistema generara el documento sin seccion de portada."
          />
        </WizardStep>
      )}

      {step === 3 && (
        <WizardStep
          stepNumber={3}
          totalSteps={3}
          title="Modo de trabajo"
          description="Elige como quieres interactuar con el sistema de clasificacion."
          onNext={handleComplete}
          onBack={handleBack}
          showBack={true}
          nextLabel="Comenzar"
        >
          <OptionCard
            selected={workMode === 'quick'}
            onClick={() => setWorkMode('quick')}
            icon={<Zap size={20} />}
            title="Modo Rapido"
            description="El sistema aplica todo automaticamente. Solo te muestra lo que necesita confirmacion."
            details={[
              'Elementos de alta confianza se aplican automaticamente',
              'Solo ves los elementos dudosos para revision',
              'Ideal para documentos bien escritos',
              'Resultado en minutos, no horas',
            ]}
          />
          <OptionCard
            selected={workMode === 'review'}
            onClick={() => setWorkMode('review')}
            icon={<FileCheck size={20} />}
            title="Modo Revision"
            description="Ves y apruebas cada elemento antes de aplicar. Control total sobre el resultado."
            details={[
              'Todos los elementos visibles para revision',
              'Apruebas o modificas cada clasificacion',
              'Ideal para documentos muy desordenados',
              'Maximo control sobre el formato final',
            ]}
          />
        </WizardStep>
      )}
    </div>
  );
};

export default Wizard;
