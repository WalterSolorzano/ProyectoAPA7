/* WordAPA7 — Element Card (Compacta, Iconos Claros, Colores por Tipo) */

import React, { useState } from 'react';
import { ElementModel, ElementType } from '../../types';
import { useDocStore } from '../../store/useDocStore';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { ContextMenu } from '../shared/ContextMenu';
import { GripVertical, Heading1, Heading2, Type, List, ListOrdered, Image, Table, Quote, Ban } from 'lucide-react';

interface ElementCardProps {
  element: ElementModel;
  showGrip?: boolean;
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  heading:      { icon: <Heading1 size={14} />, color: '#1e40af', bgColor: '#dbeafe', label: 'Titulo' },
  paragraph:    { icon: <Type size={14} />, color: '#166534', bgColor: '#dcfce7', label: 'Parrafo' },
  bullet:       { icon: <List size={14} />, color: '#7c3aed', bgColor: '#ede9fe', label: 'Vinetas' },
  numbered_list:{ icon: <ListOrdered size={14} />, color: '#7c3aed', bgColor: '#ede9fe', label: 'Numerada' },
  block_quote:  { icon: <Quote size={14} />, color: '#b45309', bgColor: '#fef3c7', label: 'Cita' },
  image:        { icon: <Image size={14} />, color: '#0369a1', bgColor: '#e0f2fe', label: 'Figura' },
  table:        { icon: <Table size={14} />, color: '#0f766e', bgColor: '#ccfbf1', label: 'Tabla' },
  empty:        { icon: <Ban size={14} />, color: '#64748b', bgColor: '#f1f5f9', label: 'Vacio' },
};

const TYPE_OPTIONS: { value: ElementType; label: string }[] = [
  { value: 'heading', label: 'Titulo (Heading)' },
  { value: 'paragraph', label: 'Parrafo Normal' },
  { value: 'bullet', label: 'Lista con Vinetas' },
  { value: 'numbered_list', label: 'Lista Numerada' },
  { value: 'block_quote', label: 'Cita en Bloque' },
  { value: 'table', label: 'Tabla' },
  { value: 'image', label: 'Figura / Imagen' },
  { value: 'empty', label: 'Vacio (Ignorar)' },
];

const HEADING_LEVELS = [
  { value: 1, label: 'Nivel 1 — Centrado, Negrita' },
  { value: 2, label: 'Nivel 2 — Izquierda, Negrita' },
  { value: 3, label: 'Nivel 3 — Izquierda, Negrita-Cursiva' },
  { value: 4, label: 'Nivel 4 — Sangrado, Negrita, Punto' },
  { value: 5, label: 'Nivel 5 — Sangrado, Negrita-Cursiva, Punto' },
];

export const ElementCard: React.FC<ElementCardProps> = ({ element, showGrip = false }) => {
  const { updateElementType, doc, showToast } = useDocStore();
  const [textValue, setTextValue] = useState(element.text);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const meta = TYPE_META[element.type] || TYPE_META.paragraph;

  const handleTypeChange = async (newType: ElementType) => {
    try { await updateElementType(element.id, newType, element.heading_level || 1, textValue); }
    catch (err: any) { showToast(err.message || 'Error al cambiar tipo de elemento', 'error'); }
  };

  const handleLevelChange = async (lvl: number) => {
    try { await updateElementType(element.id, element.type, lvl, textValue); }
    catch (err: any) { showToast(err.message || 'Error al cambiar nivel de titulo', 'error'); }
  };

  const handleTextBlur = () => {
    if (textValue !== element.text) {
      updateElementType(element.id, element.type, element.heading_level || 1, textValue)
        .catch((err: any) => showToast(err.message || 'Error al actualizar texto', 'error'));
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAcceptClassification = () => {
    if (doc) {
      updateElementType(element.id, element.type, element.heading_level || 1, element.text);
    }
  };

  const handleMarkForReview = () => {
    if (doc) {
      updateElementType(element.id, 'unknown', undefined, element.text);
    }
  };

  return (
    <>
      <div
        className="element-card"
        onContextMenu={handleContextMenu}
        style={{
          borderLeft: `4px solid ${meta.color}`,
          backgroundColor: element.needs_review ? '#fffcf5' : undefined,
        }}
      >
        {/* Header: grip + type badge + level select + confidence */}
        <div className="element-card-header">
          {showGrip && (
            <span className="element-card-grip" title="Arrastrar para reordenar">
              <GripVertical size={16} strokeWidth={2} />
            </span>
          )}

          {/* Type badge with icon and color */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: meta.bgColor,
              color: meta.color,
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {meta.icon}
            {meta.label}
          </span>

          <select
            className="element-card-type-select"
            value={element.type}
            onChange={(e) => handleTypeChange(e.target.value as ElementType)}
            style={{ fontSize: '10px', padding: '2px 6px', maxWidth: '120px' }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {element.type === 'heading' && (
            <select
              className="element-card-level-select"
              value={element.heading_level || 1}
              onChange={(e) => handleLevelChange(Number(e.target.value))}
              style={{ fontSize: '10px', padding: '2px 6px' }}
            >
              {HEADING_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
          )}

          <ConfidenceBadge
            confidence={element.confidence}
            isUserModified={element.is_user_modified}
            llmReasoning={element.llm_reasoning}
            preClassifierRule={element.pre_classifier_rule}
          />

          {element.ai_score && element.ai_score >= 0.2 && (
            <span
              className={`ai-badge ${element.ai_score >= 0.5 ? 'ai-badge-high' : element.ai_score >= 0.3 ? 'ai-badge-medium' : 'ai-badge-low'}`}
              title={element.ai_findings?.map(f => f.detail).join('; ') || 'Patrones de IA detectados'}
            >
              AI {Math.round(element.ai_score * 100)}%
            </span>
          )}
        </div>

        {/* Text area (non-media elements) */}
        {element.type !== 'image' && element.type !== 'table' && (
          <>
            {(element as any).has_math || (element as any).has_fields ? (
              <div style={{ padding: '6px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '10px', color: '#b91c1c', marginTop: '4px' }}>
                ⚠️ <strong>Edición Deshabilitada:</strong> Este elemento contiene {(element as any).has_math ? 'Ecuaciones' : 'Campos'} y se preservará intacto para proteger su formato original.
              </div>
            ) : (
              <textarea
                className="element-card-textarea"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onBlur={handleTextBlur}
                rows={Math.min(Math.max(Math.ceil(textValue.length / 80), 2), 6)}
                style={{ fontSize: '11px', minHeight: '32px' }}
              />
            )}
          </>
        )}

        {/* Image preview */}
        {element.type === 'image' && element.image_info && (
          <div className="element-card-image-preview" style={{ padding: '4px 0' }}>
            <div className="element-card-image-thumb">
              {element.image_info.relative_url ? (
                <img src={element.image_info.relative_url} alt="Figura" />
              ) : (
                <span className="text-xs text-tertiary">Sin vista previa</span>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">
                Figura {element.image_info.figure_number}
              </p>
              <p className="text-xs text-tertiary" style={{ fontSize: '10px' }}>
                {element.image_info.filename}
                {element.image_info.caption && ` — ${element.image_info.caption}`}
              </p>
              <p className="text-xs text-tertiary" style={{ fontSize: '10px', marginTop: '2px' }}>
                {element.image_info.width_cm}cm x {element.image_info.height_cm}cm
                {element.image_info.alignment !== 'center' && ` | ${element.image_info.alignment}`}
              </p>
            </div>
          </div>
        )}

        {/* Table info */}
        {element.type === 'table' && element.table_info && (
          <div className="element-card-table-info" style={{ padding: '6px 10px' }}>
            <p className="text-sm font-semibold">
              Tabla {element.table_info.table_number}
            </p>
            <p className="text-xs text-tertiary" style={{ fontSize: '10px' }}>
              {element.table_info.headers.length} columnas, {element.table_info.rows.length} filas
              {element.table_info.caption && ` — ${element.table_info.caption}`}
            </p>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          elementId={element.id}
          currentType={element.type}
          headingLevel={element.heading_level}
          onClose={() => setContextMenu(null)}
          onChangeType={async (type, headingLevel) => {
            try { await updateElementType(element.id, type, headingLevel || 1, textValue); }
            catch (err: any) { showToast(err.message || 'Error al cambiar tipo', 'error'); }
          }}
          onAcceptClassification={handleAcceptClassification}
          onMarkForReview={handleMarkForReview}
          onEnumerateRoman={() => {
            const store = useDocStore.getState();
            store.renumberHeadings('roman');
          }}
          onEnumerateDecimal={() => {
            const store = useDocStore.getState();
            store.renumberHeadings('decimal');
          }}
          onForcePageBreak={() => {
            const store = useDocStore.getState();
            const currentDoc = store.doc;
            if (!currentDoc) return;
            const updatedElements = currentDoc.elements.map((e) => {
              if (e.id === element.id) {
                const marker = (e.original_text || e.text || '') + '\n[FORCE_PAGE_BREAK]';
                return { ...e, original_text: marker };
              }
              return e;
            });
            const updatedDoc = { ...currentDoc, elements: updatedElements };
            store.pushHistory(updatedDoc);
            useDocStore.setState({ doc: updatedDoc });
          }}
          onApplyTemplate={() => {
            useDocStore.setState({ showTemplateDialog: true });
          }}
        />
      )}
    </>
  );
};
