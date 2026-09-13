/* WordAPA7 — CoverCarouselStudio (Estudio e Interfaz de Selección y Edición de Portadas).
   Modulo dedicado para el Paso 1 (Portada) alineado con la propuesta visual:
   - Barra superior horizontal "ESTILO DE PORTADA" con 5 tarjetas seleccionables:
     1. Conservar original (Recomendado)
     2. APA 7 Estándar
     3. Institucional UNI
     4. Profesional APA
     5. Personalizada (+ Subir plantilla .docx)
   - Disposición en 2 columnas:
     - Izquierda: Editor de campos en vivo (Título, Institución, Fecha, Autores/Roster).
     - Derecha: Previsualizador nativo en tiempo real (PaperCanvas, UNICoverPreview o APACoverEditor).
   Cumple las reglas estrictas de diseño: cero emojis, design tokens, blanco papel. */

import React, { useState, useRef, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Layers, Check, UploadCloud, Sparkles, University, FileText, ChevronRight
} from 'lucide-react';
import { APACoverEditor } from '../layout/APACoverEditor';
import { UNICoverPreview } from '../layout/UNICoverPreview';
import { PaperCanvas } from '../layout/PaperCanvas';
import { CoverEditorPanel } from './CoverEditorPanel';

export const CoverCarouselStudio: React.FC = () => {
  const { portada, setPortada, setCoverSetupDone, setWizardStep, showToast } = useDocStore();
  const [uploading, setUploading] = useState<boolean>(false);
  const [showCoverEditor, setShowCoverEditor] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modo actual derivado
  const currentMode: 'original' | 'apa7' | 'uni' | 'pro' | 'custom' = useMemo(() => {
    if (portada.use_original_cover !== false) return 'original';
    if (portada.cover_mode === 'generate_uni_cover') return 'uni';
    if (portada.cover_mode === 'apa_pro') return 'pro';
    if (portada.cover_template_id) return 'custom';
    return 'apa7';
  }, [portada.use_original_cover, portada.cover_mode, portada.cover_template_id]);

  const selectMode = (mode: 'original' | 'apa7' | 'uni' | 'pro' | 'custom', templateId?: string) => {
    if (mode === 'original') {
      setPortada({
        use_original_cover: true,
        force_skip_cover: false,
        cover_mode: '',
      });
    } else if (mode === 'uni') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: 'generate_uni_cover',
      });
    } else if (mode === 'pro') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: 'apa_pro',
      });
    } else if (mode === 'custom') {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
        cover_template_id: templateId || 'custom-1',
      });
    } else {
      setPortada({
        use_original_cover: false,
        force_skip_cover: false,
        cover_mode: '',
        cover_template_id: '',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      showToast(`Plantilla "${file.name}" cargada correctamente`, 'success');
      selectMode('custom', `custom-${Date.now()}`);
    } catch {
      showToast('Error al cargar la plantilla', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cards = [
    {
      id: 'original',
      title: 'Conservar original',
      subtitle: 'Mantiene logos y diseño · recomendado',
      icon: <Sparkles size={14} color="var(--accent-primary)" />,
    },
    {
      id: 'apa7',
      title: 'APA 7 Estándar',
      subtitle: 'Formato oficial 7ª edición',
      icon: <FileText size={14} color="var(--accent-primary)" />,
    },
    {
      id: 'uni',
      title: 'Institucional UNI',
      subtitle: 'Plantilla oficial universitaria',
      icon: <University size={14} color="var(--accent-primary)" />,
    },
    {
      id: 'pro',
      title: 'Profesional APA',
      subtitle: 'Con running head y página',
      icon: <Layers size={14} color="var(--accent-primary)" />,
    },
    {
      id: 'custom',
      title: '+ Subir plantilla',
      subtitle: 'Sube tu propia plantilla .docx',
      icon: <UploadCloud size={14} color="var(--accent-primary)" />,
      isUpload: true,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', backgroundColor: 'var(--canvas-bg)' }}>
      {/* ── BARRA SUPERIOR HORIZONAL: ESTILO DE PORTADA ── */}
      <div style={{
        backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              Estilo de Portada
            </div>
            <button
              type="button"
              onClick={() => setShowCoverEditor(!showCoverEditor)}
              style={{
                fontSize: '11px', fontWeight: 700, background: 'transparent',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                padding: '3px 10px', color: 'var(--accent-primary)', cursor: 'pointer'
              }}
            >
              {showCoverEditor ? 'Ocultar Editor Lateral' : 'Mostrar Editor Lateral'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setCoverSetupDone(true);
              setWizardStep(2);
            }}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '12px', fontWeight: 800, gap: '6px' }}
          >
            <span>Usar este diseño y Continuar</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Galería Horizontal de 5 Tarjetas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".docx" style={{ display: 'none' }} />
          {cards.map((c) => {
            const isSelected = currentMode === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (c.isUpload) {
                    fileInputRef.current?.click();
                  } else {
                    selectMode(c.id as any);
                  }
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? '0 4px 12px rgba(79,124,255,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px', width: '16px', height: '16px',
                    borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#fff',
                  }}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {c.icon}
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  {c.subtitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL (Editor Form + Previsualizador en Vivo) ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* COLUMNA IZQUIERDA: Panel Editor de Datos (Width: 440px) */}
        {showCoverEditor && (
          <div style={{ width: '440px', flexShrink: 0, height: '100%', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <CoverEditorPanel />
          </div>
        )}

        {/* COLUMNA DERECHA: Previsualizador Dinámico en Vivo (Flex 1) */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--canvas-bg)' }}>
          {currentMode === 'uni' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '680px', backgroundColor: 'var(--paper-white)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <UNICoverPreview />
              </div>
            </div>
          ) : currentMode === 'apa7' || currentMode === 'pro' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '680px', backgroundColor: 'var(--paper-white)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <APACoverEditor />
              </div>
            </div>
          ) : (
            <PaperCanvas />
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverCarouselStudio;
