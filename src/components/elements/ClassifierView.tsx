/* WordAPA7 — Classifier Main View with Drag & Drop (Fluent Design) */

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDocStore } from '../../store/useDocStore';
import { ElementCard } from './ElementCard';
import { ElementModel } from '../../types';
import { GripVertical } from 'lucide-react';

interface SortableElementCardProps {
  element: ElementModel;
}

const SortableElementCard: React.FC<SortableElementCardProps> = ({ element }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    marginBottom: '8px',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: 'absolute',
          left: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          cursor: 'grab',
          color: 'var(--text-tertiary)',
          padding: '8px 4px',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
        }}
        title="Arrastrar para reordenar"
      >
        <GripVertical size={16} />
      </div>
      <div style={{ paddingLeft: '24px' }}>
        <ElementCard element={element} />
      </div>
    </div>
  );
};

export const ClassifierView: React.FC = () => {
  const { doc, workMode, reorderElements } = useDocStore();
  const [filter, setFilter] = useState<'all' | 'doubtful' | 'headings' | 'media'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!doc) return null;

  const filteredElements = doc.elements.filter((e) => {
    if (e.type === 'empty') return false;
    if (workMode === 'quick' && filter === 'all') {
      // Quick mode: only show elements needing review (confidence < 0.85)
      // unless user explicitly filtered
      if (e.confidence >= 0.85 && !e.is_user_modified) return false;
    }
    if (filter === 'doubtful') return e.confidence < 0.85 && !e.is_user_modified;
    if (filter === 'headings') return e.type === 'heading';
    if (filter === 'media') return e.type === 'image' || e.type === 'table';
    return true;
  });

  const totalCount = doc.elements.filter((e) => e.type !== 'empty').length;
  const doubtfulCount = doc.elements.filter(
    (e) => e.confidence < 0.85 && !e.is_user_modified && e.type !== 'empty'
  ).length;
  const highConfCount = doc.elements.filter(
    (e) => e.confidence >= 0.85 && e.type !== 'empty'
  ).length;
  const unclassifiedCount = doc.elements.filter(
    (e) => e.confidence < 0.70 && !e.is_user_modified && e.type !== 'empty'
  ).length;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = doc.elements.findIndex((e) => e.id === active.id);
      const newIndex = doc.elements.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newElements = arrayMove(doc.elements, oldIndex, newIndex);

      // Recalculate figure/table numbers sequentially
      let figNum = 0;
      let tblNum = 0;
      const recalculated = newElements.map((e) => {
        if (e.type === 'image') {
          figNum++;
          return { ...e, image_info: e.image_info ? { ...e.image_info, figure_number: figNum } : undefined };
        }
        if (e.type === 'table') {
          tblNum++;
          return { ...e, table_info: e.table_info ? { ...e.table_info, table_number: tblNum } : undefined };
        }
        return e;
      });

      // Update locally and call backend
      useDocStore.setState({ doc: { ...doc, elements: recalculated } });
      reorderElements(recalculated.map((e) => e.id));
    },
    [doc, reorderElements]
  );

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: 'var(--bg-layer)' }}>
      {/* Semaphore */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-base)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {totalCount} elementos
          </span>
          <span style={{ fontSize: '12px', color: 'var(--status-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: 'var(--status-green)', display: 'inline-block',
            }} />
            {highConfCount} automaticos
          </span>
          {doubtfulCount > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--status-yellow)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: 'var(--status-yellow)', display: 'inline-block',
              }} />
              {doubtfulCount} para revisar
            </span>
          )}
          {unclassifiedCount > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--status-red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: 'var(--status-red)', display: 'inline-block',
              }} />
              {unclassifiedCount} sin clasificar
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            className={`btn btn-sm ${filter === 'doubtful' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('doubtful')}
            style={filter === 'doubtful' ? {} : doubtfulCount > 0 ? { borderColor: 'var(--status-yellow)', color: 'var(--status-yellow)' } : {}}
          >
            Dudosos ({doubtfulCount})
          </button>
          <button
            className={`btn btn-sm ${filter === 'headings' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('headings')}
          >
            Titulos
          </button>
          <button
            className={`btn btn-sm ${filter === 'media' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('media')}
          >
            Tablas e Imagenes
          </button>
        </div>
      </div>

      {/* Quick mode indicator */}
      {workMode === 'quick' && filter === 'all' && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'var(--accent-subtle)',
          borderRadius: '6px',
          marginBottom: '12px',
          fontSize: '12px',
          color: 'var(--accent)',
        }}>
          Modo Rapido: {highConfCount} elementos de alta confianza ya estan aplicados. Solo se muestran los que necesitan revision.
        </div>
      )}

      {/* DnD Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredElements.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {filteredElements.map((elem) => (
            <SortableElementCard key={elem.id} element={elem} />
          ))}
        </SortableContext>
      </DndContext>

      {filteredElements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          No hay elementos que mostrar con este filtro.
        </div>
      )}
    </div>
  );
};
