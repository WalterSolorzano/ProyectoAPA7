import React, { useState, useRef, useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, ListFilter, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';

// Sortable Item wrapper
const SortableItem = ({ elem, isSelected, style, onClick, isDragDisabled }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: elem.id,
    disabled: isDragDisabled
  });

  const isHeading = elem.type === 'heading';
  const lvl = elem.heading_level || 1;
  const indentPx = isHeading ? (lvl - 1) * 10 : 0;

  const dndStyle = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...style,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      onClick={onClick}
    >
      <div
        style={{
          marginLeft: `${indentPx}px`,
          padding: '8px 10px',
          marginBottom: '6px',
          borderRadius: '4px',
          border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)'}`,
          backgroundColor: isSelected ? 'rgba(124,92,252,0.1)' : 'transparent',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          color: 'var(--text-main)',
        }}
        onMouseOver={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,92,252,0.1)';
        }}
        onMouseOut={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        {!isDragDisabled && (
          <div
            {...attributes}
            {...listeners}
            style={{ padding: '2px', marginTop: '2px', color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {elem.type}
              {elem.heading_level === 1 && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(124,92,252,0.15)', color: '#9b79ff' }}>H1</span>}
              {elem.heading_level === 2 && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(6,214,160,0.15)', color: '#06d6a0' }}>H2</span>}
              {elem.heading_level === 3 && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>H3</span>}
            </span>
            <ConfidenceBadge confidence={elem.confidence} isUserModified={elem.is_user_modified} />
          </div>

          <p style={{
            fontSize: '11px',
            color: 'var(--text-main)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: isHeading ? 600 : 400
          }}>
            {elem.text || (elem.image_info ? `Figura: ${elem.image_info.filename}` : `Tabla ${elem.table_info?.table_number}`)}
          </p>
        </div>
      </div>
    </div>
  );
};

export const DocumentOutlinePane: React.FC = () => {
  const { doc, selectedElementId, setSelectedElementId, reorderElements, isLoading } = useDocStore();
  const [filter, setFilter] = useState<'problems' | 'headings' | 'all'>('problems');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  
  const parentRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!doc) return null;

  if (isCollapsed) {
    return (
      <div onClick={() => setIsCollapsed(false)} style={{ width: '40px', minWidth: '40px', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', cursor: 'pointer', transition: 'all 0.2s ease' }} title="Mostrar Esquema de Navegación">
        <button className="btn btn-secondary btn-xs" style={{ padding: '6px', borderRadius: '50%' }} onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}>
          <Eye size={16} color="var(--accent-primary)" />
        </button>
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '16px' }}>
          ESQUEMA
        </span>
      </div>
    );
  }

  const problemElements = doc.elements.filter((e) => e.type !== 'empty' && e.confidence < 0.85 && !e.is_user_modified);
  const headingElements = doc.elements.filter((e) => e.type === 'heading');

  const displayElements = useMemo(() => {
    return doc.elements.filter((e) => {
      if (e.type === 'empty') return false;
      if (filter === 'problems') return e.confidence < 0.85 && !e.is_user_modified;
      if (filter === 'headings') return e.type === 'heading';
      return true;
    });
  }, [doc.elements, filter]);

  const elementIds = useMemo(() => displayElements.map(e => e.id), [displayElements]);

  const virtualizer = useVirtualizer({
    count: displayElements.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65, // Estimación de altura de cada tarjeta (45px + padding/margin)
    overscan: 5,
  });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (filter !== 'all') {
      useDocStore.getState().showToast('Reordenamiento solo disponible en vista Todos', 'info');
      return;
    }
    if (active.id !== over.id) {
      const oldIndex = displayElements.findIndex(e => e.id === active.id);
      const newIndex = displayElements.findIndex(e => e.id === over.id);
      
      const newDisplayOrder = arrayMove(displayElements, oldIndex, newIndex);
      
      // Aplicar el nuevo orden al store
      // En WordAPA7 usamos los IDs completos del documento
      const allElementIds = [...doc.elements.map(e => e.id)];
      const realSourceIndex = allElementIds.indexOf(active.id as string);
      const realDestIndex = allElementIds.indexOf(over.id as string);
      
      const [removed] = allElementIds.splice(realSourceIndex, 1);
      allElementIds.splice(realDestIndex, 0, removed);
      
      reorderElements(allElementIds);
    }
  };

  return (
    <div className="nav-pane" style={{ width: '300px', minWidth: '300px', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
      
      <div className="nav-pane-header" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ListFilter size={14} color="var(--accent-primary)" /> ESQUEMA
        </span>
        <button onClick={() => setIsCollapsed(true)} style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', transition: 'background 0.15s ease' }}>
          <EyeOff size={14} /> Ocultar
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <button className={`ribbon-tab ${filter === 'problems' ? 'active' : ''}`} onClick={() => setFilter('problems')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: problemElements.length > 0 ? '#dc2626' : 'inherit', backgroundColor: filter === 'problems' && problemElements.length > 0 ? '#fee2e2' : undefined }}>
          <AlertTriangle size={12} style={{ marginRight: '4px' }} /> Problemas ({problemElements.length})
        </button>
        <button className={`ribbon-tab ${filter === 'headings' ? 'active' : ''}`} onClick={() => setFilter('headings')} style={{ padding: '4px 10px', fontSize: '11px' }}>
          Títulos ({headingElements.length})
        </button>
        <button className={`ribbon-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} style={{ padding: '4px 10px', fontSize: '11px' }}>
          Todos
        </button>
      </div>

      <div ref={parentRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} style={{ height: '55px', backgroundColor: '#f1f5f9', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
            ))}
          </div>
        ) : (
          <>
            {filter === 'problems' && (
              <div style={{ marginBottom: '12px' }}>
                {problemElements.length === 0 ? (
                  <div style={{ padding: '16px', backgroundColor: '#dcfce7', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <CheckCircle2 size={24} color="#16a34a" style={{ display: 'block', margin: '0 auto 6px auto' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d' }}>¡No hay problemas detectados!</span>
                  </div>
                ) : (
                  <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                      Revisión Necesaria
                    </span>
                    <p style={{ fontSize: '11px', color: '#991b1b', margin: '4px 0 0 0' }}>El modelo LLM marcó {problemElements.length} bloque(s) con confianza baja. Revisa y aprueba manualmente.</p>
                  </div>
                )}
              </div>
            )}

            {displayElements.length > 0 && (
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={onDragEnd}
                // Auto-scroll nativo de dnd-kit funciona apuntando al contenedor con overflowY: auto
              >
                <SortableContext items={elementIds} strategy={verticalListSortingStrategy}>
                  <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const elem = displayElements[virtualRow.index];
                      return (
                        <SortableItem
                          key={elem.id}
                          elem={elem}
                          isSelected={selectedElementId === elem.id}
                          onClick={() => setSelectedElementId(elem.id)}
                          isDragDisabled={filter !== 'all'}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`
                          }}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>
    </div>
  );
};
