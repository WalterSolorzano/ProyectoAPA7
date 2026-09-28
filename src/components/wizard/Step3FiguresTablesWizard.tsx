import React, { useState, useMemo, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { needsReview } from '../../lib/portadaAuthors';
import { PaperCanvas } from '../layout/PaperCanvas';
import { MiniToolbar, MiniToolbarAction } from '../MiniToolbar';
import { resolveAssetUrl } from '../../api/backend';
import { Image, Table, AlignLeft, AlignCenter, AlignRight, RotateCcw, Trash2, PanelRight, Search, Filter, Sparkles, Loader2, ChevronRight } from 'lucide-react';

type SectionGroup = {
  key: string;
  title: string;
  level: 1 | 2;
  items: any[];
};


const controlSelectStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '28px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--canvas-bg)',
  color: 'var(--text-main)',
  fontSize: '11px',
  fontFamily: 'inherit',
  padding: '4px 7px',
};

const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0,
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--sidebar-bg)',
};

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
  // C6: Auto-caption all button
  const autoCaptionAll = useDocStore((s) => s.autoCaptionAll);
  const isLoading = useDocStore((s) => s.isLoading);
  const [autoCaptionLoading, setAutoCaptionLoading] = useState(false);

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

  const sectionMap = useMemo(() => {
    const map = new Map<string, { title: string; level: 1 | 2 }>();
    let currentH1 = { title: 'Portada', level: 1 as const };
    let currentH2: { title: string; level: 2 } | null = null;

    for (const element of doc?.elements ?? []) {
      if (element.type === 'heading' && !element.is_cover_section && (element.heading_level === 1 || element.heading_level === 2)) {
        const title = (element.text || '').trim() || (element.heading_level === 1 ? 'Sección principal' : 'Subsección');
        if (element.heading_level === 1) {
          currentH1 = { title, level: 1 };
          currentH2 = null;
        } else {
          currentH2 = { title, level: 2 };
        }
      }

      if ((element.type === 'image' || element.type === 'table') && !element.is_cover_section) {
        const section = currentH2 ?? currentH1;
        map.set(element.id, { title: section.title, level: section.level });
      }
    }

    return map;
  }, [doc?.elements]);

  const groupedItems = useMemo<SectionGroup[]>(() => {
    const groups = new Map<string, SectionGroup>();

    filteredItems.forEach((item) => {
      const ctx = sectionMap.get(item.id) ?? { title: 'Portada', level: 1 as const };
      const key = `${ctx.level}:${ctx.title}`;
      const group = groups.get(key) ?? { key, title: ctx.title, level: ctx.level, items: [] };
      group.items.push(item);
      groups.set(key, group);
    });

    return Array.from(groups.values());
  }, [filteredItems, sectionMap]);


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
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            {/* C6: Leyendas IA para todo */}
            {(figures.length + tables.length) > 0 && (
              <button
                type="button"
                onClick={async () => {
                  setAutoCaptionLoading(true);
                  try {
                    await autoCaptionAll();
                  } finally {
                    setAutoCaptionLoading(false);
                  }
                }}
                disabled={autoCaptionLoading || isLoading}
                title="Sugerir leyendas APA 7 con IA para todas las figuras y tablas sin título"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                  fontSize: '11px', fontWeight: 600, cursor: (autoCaptionLoading || isLoading) ? 'wait' : 'pointer',
                  fontFamily: 'inherit', borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-accent-soft)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                }}
              >
                {autoCaptionLoading
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
                  : <><Sparkles size={12} /> Leyendas IA para todo</>}
              </button>
            )}
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
                <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>X</button>
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
                backgroundColor: onlyReview ? 'var(--color-warning-a12)' : 'transparent',
                border: `1px solid ${onlyReview ? 'var(--color-warning-a40)' : 'var(--border-subtle)'}`,
                color: onlyReview ? 'var(--color-warning)' : 'var(--text-secondary)',
              }}
            >
              <Filter size={11} /> Pendientes
            </button>
          </div>

          {subTab === 'tables' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Controles de tabla
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={controlGroupStyle}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estilo académico</span>
                  <select
                    value={selectedTableStyle}
                    onChange={(e) => {
                      if (!selectedTable) {
                        useDocStore.getState().showToast('Selecciona una tabla primero', 'warning');
                        return;
                      }
                      setTableStyle(selectedTable.id, e.target.value as 'standard' | 'compact' | 'expanded');
                    }}
                    style={controlSelectStyle}
                  >
                    <option value="standard">APA estándar</option>
                    <option value="compact">APA compacto</option>
                    <option value="expanded">APA expandido</option>
                  </select>
                </div>
                <div style={controlGroupStyle}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contexto</span>
                  <div style={{ fontSize: '10px', lineHeight: 1.35, color: 'var(--text-main)' }}>
                    {selectedTable ? sectionMap.get(selectedTable.id)?.title || 'Sin sección' : 'Selecciona una tabla'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentReview > 0 && (
            <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--color-warning)' }}>
              {currentReview} pendiente{currentReview > 1 ? 's' : ''} de revisión
            </div>
          )}

        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {groupedItems.length === 0 && (
            <div style={{
              padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)',
              fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            }}>
              {/* El icono del vacío es un ícono de lucide, como todos los
                 demás: acá había un emoji que además llegó corrupto, con un
                 selector de variación pegado y sin glifo detrás. */}
              {subTab === 'figures' ? (
                <Image size={28} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-muted)' }} />
              ) : (
                <Table size={28} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-muted)' }} />
              )}
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
          {groupedItems.map((group) => (
            <div key={group.key} style={{ marginBottom: '10px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 8px', marginBottom: '4px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-accent-soft)',
                border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {group.level === 1 ? 'H1' : 'H2'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>{group.title}</span>
              </div>

              {group.items.map((item) => {
                const isImage = item.type === 'image';
                const info = isImage ? item.image_info : (item as any).table_info;
                const number = info?.figure_number || info?.table_number || 0;
                const label = isImage ? `Figura ${number}` : `Tabla ${number}`;
                const needsAttn = needsReview(item as any);
                const thumbUrl = isImage ? resolveAssetUrl(info?.relative_url) : null;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedElementId(item.id);
                      useDocStore.getState().setScrollTargetId(item.id);
                      if (isImage) {
                        useDocStore.getState().setImagePanelOpen(true);
                      }
                      if (!useDocStore.getState().liveChatOpen) {
                        useDocStore.getState().setForceRightPanelOpen(true);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', marginBottom: 3, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                      borderLeft: needsAttn ? '3px solid var(--color-warning)' : '3px solid transparent',
                      backgroundColor: selectedElementId === item.id ? 'var(--color-accent-soft)' : needsAttn ? 'var(--color-warning-a05)' : 'transparent',
                      fontSize: '12px', color: 'var(--color-text-primary)',
                    }}
                  >
                    {isImage ? (
                      thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={label}
                          style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xs)', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                        />
                      ) : (
                        <div style={{
                          width: '48px', height: '48px', borderRadius: 'var(--radius-xs)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                        }}>
                          <Image size={18} />
                        </div>
                      )
                    ) : (
                      <div style={{
                        width: '48px', height: '48px', borderRadius: 'var(--radius-xs)', flexShrink: 0,
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
                        {needsAttn && <span style={{ fontSize: '9px', color: 'var(--color-warning)', fontWeight: 700 }}>revisar</span>}
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
          ))}
        </div>
      </div>
      )}

      {/* Container: use display:flex + flexDirection:column so PaperCanvas's
          flex:1 + height:100% properly constrain its height and handle its own
          scrolling. Previously overflowY:'auto' here created a nested-scroll
          conflict with PaperCanvas's own overflowY:'auto'. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <PaperCanvas onElementClick={handleElementClick} />
        {/* Botón de acción rápida: Siguiente etapa */}
        <div style={{
          position: 'absolute', bottom: 20, right: 24, zIndex: 30,
          display: 'flex', gap: '8px',
        }}>
          <button
            type="button"
            onClick={() => useDocStore.getState().setWizardStep(4)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--color-text-on-accent)',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--color-accent-a40)',
              fontFamily: 'inherit',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span>Siguiente: Referencias</span>
            <ChevronRight size={16} strokeWidth="var(--icon-stroke)" />
          </button>
        </div>
      </div>

      {/* El panel de edición de imagen ahora vive a nivel raíz en App.tsx
          (ImageEditSidePanel) para estar disponible en cualquier paso. */}

      <MiniToolbar
        items={imageActions}
        anchorRect={toolbarAnchor}
        visible={toolbarAnchor !== null}
        onClose={() => { setToolbarAnchor(null); setToolbarElementId(null); }}
      />
    </div>
  );
};
