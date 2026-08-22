import React, { useState, useMemo, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { needsReview } from '../../lib/portadaAuthors';
import { PaperCanvas } from '../layout/PaperCanvas';
import { MiniToolbar, MiniToolbarAction } from '../MiniToolbar';
import { ImageEditPanel } from '../inspector/ImageEditPanel';
import { resolveAssetUrl } from '../../api/backend';
import { Image, Table, AlignLeft, AlignCenter, AlignRight, RotateCcw, Trash2, PanelRight, Search, Filter } from 'lucide-react';

export const Step3FiguresTablesWizard: React.FC = () => {
  const [subTab, setSubTab] = useState<'figures' | 'tables'>('figures');
  const [query, setQuery] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
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

  // Exclude cover-section images (logos) from the figures list — they are part
  // of the cover layout, not content figures that need APA 7 figure numbering.
  const figures = doc?.elements.filter((e) => e.type === 'image' && !e.is_cover_section) ?? [];
  const tables = doc?.elements.filter((e) => e.type === 'table') ?? [];
  const selectedImage = figures.find((f) => f.id === selectedElementId) || null;
  const selectedTable = tables.find((t) => t.id === selectedElementId) || null;
  const selectedTableStyle = (selectedTable ? tableStyles[selectedTable.id] : undefined) || 'standard';
  const reviewFigures = figures.filter((f) => needsReview(f as any)).length;
  const reviewTables = tables.filter((t) => needsReview(t as any)).length;

  const currentItems = subTab === 'figures' ? figures : tables;
  const currentReview = subTab === 'figures' ? reviewFigures : reviewTables;

  // Buscador + filtro de pendientes (Capa 5)
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return currentItems.filter((item) => {
      if (onlyReview && !needsReview(item as any)) return false;
      if (!q) return true;
      const info = item.type === 'image' ? item.image_info : (item as any).table_info;
      const number = info?.figure_number || info?.table_number || 0;
      const label = item.type === 'image' ? `Figura ${number}` : `Tabla ${number}`;
      const caption = (info as any)?.caption || '';
      return label.toLowerCase().includes(q) || caption.toLowerCase().includes(q);
    });
  }, [currentItems, query, onlyReview]);

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
      {listCollapsed ? (
        <div style={{
          width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)', paddingTop: 8,
        }}>
          <button
            type="button"
            onClick={() => setListCollapsed(false)}
            title="Mostrar lista de figuras y tablas"
            aria-label="Mostrar lista de figuras y tablas"
            style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Image size={16} />
          </button>
        </div>
      ) : (
      <div style={{
        width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Image size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', flex: 1 }}>
              Figuras y tablas ({figures.length + tables.length})
            </span>
            <button
              type="button"
              onClick={() => setListCollapsed(true)}
              title="Colapsar lista y dejar más lugar al documento"
              aria-label="Colapsar lista"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
            >
              <PanelRight size={12} style={{ transform: 'rotate(180deg)' }} />
            </button>
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

          {/* Buscador + filtro de pendientes */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', backgroundColor: 'var(--canvas-bg)' }}>
              <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar ${subTab === 'figures' ? 'figura' : 'tabla'} por número o título…`}
                style={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '11px', backgroundColor: 'transparent', color: 'var(--text-main)', fontFamily: 'inherit' }}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>✕</button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOnlyReview(!onlyReview)}
              aria-pressed={onlyReview}
              title="Mostrar solo elementos pendientes de revisión"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 7px', fontSize: '10px', fontWeight: 600,
                cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit',
                backgroundColor: onlyReview ? 'rgba(250,173,20,0.14)' : 'transparent',
                border: `1px solid ${onlyReview ? 'rgba(250,173,20,0.4)' : 'var(--border-subtle)'}`,
                color: onlyReview ? 'var(--accent-warning)' : 'var(--text-secondary)',
              }}
            >
              <Filter size={11} /> Pendientes
            </button>
          </div>

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
          {filteredItems.length === 0 && (
            <div style={{
              padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)',
              fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '28px' }}>{subTab === 'figures' ? '🖼️' : '📊'}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {currentItems.length === 0
                  ? `No se detectaron ${subTab === 'figures' ? 'figuras' : 'tablas'}`
                  : 'Sin coincidencias'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {currentItems.length === 0
                  ? `Tu documento no contiene ${subTab === 'figures' ? 'imágenes insertadas' : 'tablas de datos'}. Podés continuar al siguiente paso con tranquilidad.`
                  : 'Ningún elemento coincide con la búsqueda o el filtro de pendientes.'}
              </span>
            </div>
          )}
          {filteredItems.map((item) => {
            const isImage = item.type === 'image';
            const info = isImage ? item.image_info : (item as any).table_info;
            const number = info?.figure_number || info?.table_number || 0;
            const label = isImage ? `Figura ${number}` : `Tabla ${number}`;
            const needsAttn = needsReview(item as any);
            const thumbUrl = isImage ? resolveAssetUrl(info?.relative_url) : null;

            return (
              <div key={item.id} onClick={() => setSelectedElementId(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', marginBottom: 3, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                borderLeft: needsAttn ? '3px solid var(--color-warning)' : '3px solid transparent',
                backgroundColor: selectedElementId === item.id ? 'var(--color-accent-soft)' : needsAttn ? 'rgba(250,173,20,0.06)' : 'transparent',
                fontSize: '12px', color: 'var(--color-text-primary)',
              }}>
                {/* Miniatura (figuras) o ícono (tablas) */}
                {isImage ? (
                  thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={label}
                      style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                    />
                  ) : (
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '6px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}>
                      <Image size={18} />
                    </div>
                  )
                ) : (
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}>
                    <Table size={18} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    {needsAttn && <span style={{ fontSize: '9px', color: 'var(--accent-warning)', fontWeight: 700 }}>revisar</span>}
                  </div>
                  {(info as any)?.caption && (
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(info as any).caption}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Container: use display:flex + flexDirection:column so PaperCanvas's
          flex:1 + height:100% properly constrain its height and handle its own
          scrolling. Previously overflowY:'auto' here created a nested-scroll
          conflict with PaperCanvas's own overflowY:'auto'. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column' }}>
        <PaperCanvas onElementClick={handleElementClick} />
      </div>

      {/* Panel modular de edición de imagen (tarjetas colapsables verticales) */}
      {selectedImage && imagePanelOpen && (
        <div style={{
          width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
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
