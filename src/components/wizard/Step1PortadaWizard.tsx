/* WordAPA7 — Paso 1: Portada Wizard (Vista Comparativa Antes vs Arreglado) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Layout, ShieldCheck, FileCode, Eye, X } from 'lucide-react';
import { PaperCanvas } from '../layout/PaperCanvas';

export const Step1PortadaWizard: React.FC = () => {
  const { portada, setPortada, doc } = useDocStore();
  const [showXmlViewer, setShowXmlViewer] = useState(false);

  const useOriginal = portada.use_original_cover !== false;

  // Get portada fields and textbox texts from doc model
  const portadaFields: Record<string, string> = (doc as any)?.portada?.fields || {};
  const textboxTexts: string[] = (doc as any)?.portada?.textbox_texts || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Banner Superior Explicativo del Paso 1 */}
      <div style={{
        backgroundColor: 'var(--canvas-bg)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layout size={18} /> Paso 1: Verificacion de la Hoja de Portada
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Compara como venia tu portada en el archivo original vs. como queda en el lienzo de trabajo.
          </span>
        </div>

        {/* Acciones Rapidas de Portada */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${useOriginal ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPortada({ use_original_cover: true })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
          >
            <ShieldCheck size={14} /> Conservar Portada Intacta {useOriginal && '(Activo)'}
          </button>
          <button
            className={`btn btn-sm ${!useOriginal ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPortada({ use_original_cover: false })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
          >
            <ShieldCheck size={14} /> Formatear APA 7 {!useOriginal && '(Activo)'}
          </button>
          {textboxTexts.length > 0 && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowXmlViewer(!showXmlViewer)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px', borderColor: '#cbd5e1' }}
              title="Ver contenido XML detectado de la portada"
            >
              <FileCode size={14} /> Recrear Portada desde XML {showXmlViewer && '(Activo)'}
            </button>
          )}
        </div>
      </div>

      {/* XML Cover Viewer Panel */}
      {showXmlViewer && textboxTexts.length > 0 && (
        <div style={{
          backgroundColor: 'var(--canvas-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 24px',
          maxHeight: '260px',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={14} /> Contenido XML de la Portada Detectado
            </h4>
            <button
              onClick={() => setShowXmlViewer(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
              title="Cerrar visor XML"
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Campos Detectados
              </span>
              <div style={{ backgroundColor: 'var(--canvas-bg)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {Object.entries(portadaFields).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: '80px' }}>{key}:</span>
                    <span style={{ color: 'var(--text-main)' }}>{String(val)}</span>
                  </div>
                ))}
                {Object.keys(portadaFields).length === 0 && (
                  <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No se detectaron campos</span>
                )}
              </div>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Textboxes (Raw XML)
              </span>
              <div style={{ backgroundColor: 'var(--canvas-bg)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
                {textboxTexts.map((t: string, i: number) => (
                  <div key={i} style={{ color: 'var(--text-secondary)', padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{i + 1}.</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor Principal del Lienzo / Vista Previa */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <PaperCanvas />
      </div>
    </div>
  );
};

export default Step1PortadaWizard;
