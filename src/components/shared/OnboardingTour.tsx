import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Badge, Modal, Card } from '../ui/wordapa7';
import { ArrowRight, X } from 'lucide-react';

export const OnboardingTour: React.FC = () => {
  const { doc, wizardStep, hasSeenTour, setHasSeenTour } = useDocStore();

  if (!doc || hasSeenTour || wizardStep !== 0) return null;

  return (
    <Modal open={true} style={{ width: 'min(920px, 100%)', padding: '0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', minHeight: '540px' }}>
        <div style={{ padding: '32px', borderRight: '1px solid var(--border-subtle)' }}>
          <Badge tone="accent" style={{ marginBottom: '16px' }}>Bienvenido</Badge>
          <h2 style={{ fontSize: '30px', lineHeight: 1.1, fontWeight: 800, margin: '0 0 12px' }}>¡Bienvenido a WordAPA7!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
            Antes de ajustar preferencias, te mostramos el flujo de trabajo. El resto de la interfaz queda bloqueada para que no haya dudas sobre qué está activo.
          </p>

          <div style={{ marginTop: '24px', display: 'grid', gap: '12px' }}>
            <Card>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>1. Portada</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Elige la plantilla y completa los metadatos del documento.</div>
            </Card>
            <Card>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>2 a 5. Títulos, figuras, tablas y cuerpo</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cada paso mantiene el mismo lenguaje visual y estados claros.</div>
            </Card>
            <Card>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>6 y 7. Referencias y validación</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Construye la lista de referencias y cruza las citas contra ella.</div>
            </Card>
          </div>
        </div>

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '8px' }}>Flujo guiado</div>
              <h3 style={{ fontSize: '22px', margin: 0 }}>La pantalla de fondo queda desactivada hasta que continúes.</h3>
            </div>
            <button onClick={() => setHasSeenTour(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} aria-label="Cerrar bienvenida">
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <Card>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Descarga</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>El botón Descargar está siempre disponible en la barra superior. Elige el formato al exportar.</div>
            </Card>
            <Card>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Navegación libre</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Puedes saltar entre pasos desde la barra superior o seguir el orden con Siguiente/Anterior.</div>
            </Card>
          </div>

          <button
            onClick={() => setHasSeenTour(true)}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: 700,
            }}
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
