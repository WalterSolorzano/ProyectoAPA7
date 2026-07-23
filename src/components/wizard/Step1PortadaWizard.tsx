/* WordAPA7 — Paso 1: Portada Wizard (Vista Comparativa Antes vs Arreglado) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, ShieldCheck, CheckCircle, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step1PortadaWizard: React.FC = () => {
  const { portada, setPortada } = useDocStore();

  const useOriginal = portada.use_original_cover !== false;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Banner Superior Explicativo del Paso 1 */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--word-blue)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layout size={18} /> Paso 1: Verificación de la Hoja de Portada
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Compara cómo venía tu portada en el archivo original vs. cómo queda en el lienzo de trabajo.
          </span>
        </div>

        {/* Acciones Rápidas de Portada en 1 Clic */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className={`btn btn-sm ${useOriginal ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPortada({ use_original_cover: true })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
          >
            <ShieldCheck size={14} /> Conservar Portada Intacta {useOriginal && '✓'}
          </button>
          <button
            className={`btn btn-sm ${!useOriginal ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPortada({ use_original_cover: false })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
          >
            <Sparkles size={14} /> Formatear APA 7 {!useOriginal && '✓'}
          </button>
        </div>
      </div>

      {/* Contenedor Principal del Lienzo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};
