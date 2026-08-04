import React, { useState, useMemo, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { needsReview } from '../../lib/portadaAuthors';
import { PaperCanvas } from '../layout/PaperCanvas';
import { MiniToolbar, MiniToolbarAction } from '../MiniToolbar';
import { ImageEditPanel } from '../inspector/ImageEditPanel';
import { Image, Table, AlignLeft, AlignCenter, AlignRight, RotateCcw, Trash2, PanelRight } from 'lucide-react';

export const Step3FiguresTablesWizard: React.FC = () => {
  const [subTab, setSubTab] = useState<'figures' | 'tables'>('figures');
  const doc = useDocStore((s) => s.doc);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const tableStyles = useDocStore((s) => s.tableStyles);
  const setTableStyle = useDocStore((s) => s.setTableStyle);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const imagePanelOpen = useDocStore((s) => s.imagePanelOpen);
  const setImagePanelOpen = useDocStore((s) => s.setImagePanelOpen);

  const [toolbarAnchor, setToolbarAnchor] = useState<DOMRect | null>(null);
  const [toolbarElementId, setToolbarElementId] = useState<string | null>(null);

  const figures = doc?.elements.filter((e) => e.type === 'image') ?? [];
  const tables = doc?.elements.filter((e) => e.type === 'table') ?? [];
  const selectedImage = figures.find((f) => f.id === selectedElementId) || null;
  const selectedTable = tables.find((t) => t.id === selectedElementId) || null;
  const selectedTableStyle = (selectedTable ? tableStyles[selectedTable.id] : undefined) || 'standard';
  const reviewFigures = figures.filter((f) => needsReview(f as any)).length;
  const reviewTables = tables.filter((t) => needsReview(t as any)).length;

  const currentItems = subTab === 'figures' ? figures : tables;
  const currentReview = subTab === 'figures' ? reviewFigures : reviewTables;

  const handleElementClick = useCallback((elementId: string, rect: DOMRect, element: any) => {
    if (subTab === 'figures' && element.type === 'image') {
      setToolbarElementId(elementId);
      setToolbarAnchor(rect);
      setImagePanelOpen(true);
    } else {
      setToolbarAnchor(null);
      setToolbarElementId(null);
    }
  }, [subTab, setImagePanelOpen]);

  const imageActions: MiniToolbarAction[] = useMemo(() => {
    if (!toolbarElementId) return [];
    const img = figures.find((f) => f.id === toolbarElementId);
    const align = img?.image_info?.alignment || 'center';
    return [
      { id: 'align-left', label: 'Alinear izquierda', icon: AlignLeft, active: align === 'left', onClick: () => updateElementImage(toolbarElementId, { alignment: 'left' }) },
      { id: 'align-center', label: 'Centrar', icon: AlignCenter, active: align === 'center', onClick: () => updateElementImage(toolbarElementId, { alignment: 'center' }) },
      { id: 'align-right', label: 'Alinear derecha', icon: AlignRight, active: align === 'right', onClick: () => updateElementImage(toolbarElementId, { alignment: 'right' }) },
      { id: 'separator', label: '', icon: () => null, onClick: () => {} },
      { id: 'reset-size', label: 'Reset tamaño', icon: RotateCcw, active: false, onClick: () => updateElementImage(toolbarElementId, { width_cm: undefined, height_cm: undefined }) },
      { id: 'delete', label: 'Eliminar', icon: Trash2, active: false, onClick: () => {
        useDocStore.getState().updateElementType(toolbarElementId, 'paragraph', 1);
      }},
    ];
  }, [toolbarElementId, figures, updateElementImage]);

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <div style={{
        width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Image size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', flex: 1 }}>
              Figuras y tablas ({figures.length + tables.length})
            </span>
            {selectedImage && (
              <button
                type="button"
                onClick={() => setImagePanelOpen(!imagePanelOpen)}
                title={imagePanelOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
                aria-pressed={imagePanelOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                  fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: imagePanelOpen ? 'var(--color-accent-soft)' : 'transparent',
                  border: `1px solid ${imagePanelOpen ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  color: imagePanelOpen ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                <PanelRight size={12} /> {imagePanelOpen ? 'Edición' : 'Editar'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: 8 }}>
            <button type="button" onClick={() => setSubTab('figures')} style={{ flex: 1, border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: '11px', fontWeight: 500, backgroundColor: subTab === 'figures' ? 'var(--color-accent-soft)' : 'transparent', color: subTab === 'figures' ? 'var(--accent-primary)' : 'var(--color-text-secondary)' }}>Figuras ({figures.length})</button>
            <button type="button" onClick={() => setSubTab('tables')} style={{ flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer', padding: '5px 0', fontSize: '11px', fontWeight: 500, backgroundColor: subTab === 'tables' ? 'var(--color-accent-soft)' : 'transparent', color: subTab === 'tables' ? 'var(--accent-primary)' : 'var(--color-text-secondary)' }}>Tablas ({tables.length})</button>
          </div>

          {subTab === 'figures' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <span>Leyenda:</span>
              {(['above', 'below'] as const).map((pos) => {
                const active = (selectedImage?.image_info?.caption_position ?? 'below') === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      if (!selectedImage) {
                        useDocStore.getState().showToast('Selecciona una figura primero', 'warning');
                        return;
                      }
                      updateElementImage(selectedImage.id, { caption_position: pos });
                    }}
                    style={{ padding: '2px 8px', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', fontWeight: active ? 600 : 400, backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent', color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)' }}
                  >
                    {pos === 'above' ? 'Arriba' : 'Abajo'}
                  </button>
                );
              })}
            </div>
          )}

          {subTab === 'tables' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: 6 }}>
              <span>Estilo:</span>
              {(['standard', 'compact', 'expanded'] as const).map((style) => {
                const active = selectedTableStyle === style;
                const label = style === 'standard' ? 'APA estándar' : style === 'compact' ? 'APA compacto' : 'APA expandido';
                return (
                  <button key={style} type="button" onClick={() => {
                    if (!selectedTable) {
                      useDocStore.getState().showToast('Selecciona una tabla primero', 'warning');
                      return;
                    }
                    setTableStyle(selectedTable.id, style);
                  }} style={{
                    padding: '2px 8px', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px',
                    fontWeight: active ? 600 : 400,
                    backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                    color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                  }}>{label}</button>
                );
              })}
            </div>
          )}

          {currentReview > 0 && (
            <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--color-warning)' }}>
              {currentReview} pendiente{currentReview > 1 ? 's' : ''} de revisión
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {currentItems.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
              No se detectaron {subTab === 'figures' ? 'figuras' : 'tablas'}.
            </div>
          )}
          {currentItems.map((item) => {
            const isImage = item.type === 'image';
            const info = isImage ? item.image_info : (item as any).table_info;
            const number = info?.figure_number || info?.table_number || 0;
            const label = isImage ? `Figura ${number}` : `Tabla ${number}`;
            const needsAttn = needsReview(item as any);

            return (
              <div key={item.id} onClick={() => setSelectedElementId(item.id)} style={{
                padding: '7px 10px', marginBottom: 3, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                borderLeft: needsAttn ? '3px solid var(--color-warning)' : '3px solid transparent',
                backgroundColor: selectedElementId === item.id ? 'var(--color-accent-soft)' : needsAttn ? 'rgba(250,173,20,0.06)' : 'transparent',
                fontSize: '12px', color: 'var(--color-text-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isImage ? <Image size={12} /> : <Table size={12} />}
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </div>
                {(info as any)?.caption && (
                  <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginLeft: 18, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(info as any).caption}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--canvas-bg)' }}>
        <PaperCanvas onElementClick={handleElementClick} />
      </div>

      {/* Panel modular de edición de imagen (tarjetas colapsables verticales) */}
      {selectedImage && imagePanelOpen && (
        <div style={{
          width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Panel de edición
            </span>
            <button
              type="button"
              onClick={() => setImagePanelOpen(false)}
              title="Ocultar panel"
              aria-label="Ocultar panel de edición"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)',
                fontFamily: 'inherit', fontSize: '14px', lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <ImageEditPanel elem={selectedImage} />
          </div>
        </div>
      )}

      <MiniToolbar
        items={imageActions}
        anchorRect={toolbarAnchor}
        visible={toolbarAnchor !== null}
        onClose={() => { setToolbarAnchor(null); setToolbarElementId(null); }}
      />
    </div>
  );
};
