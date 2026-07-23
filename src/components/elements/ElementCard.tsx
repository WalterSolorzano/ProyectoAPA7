/* WordAPA7 — Element Card (Fluent Design, grip handle, confidence badge, context menu) */

import React, { useState } from 'react';
import { ElementModel, ElementType } from '../../types';
import { useDocStore } from '../../store/useDocStore';
import { ConfidenceBadge } from '../shared/ConfidenceBadge';
import { ContextMenu } from '../shared/ContextMenu';
import { GripVertical } from 'lucide-react';

interface ElementCardProps {
  element: ElementModel;
  showGrip?: boolean;
}

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
  const { updateElementType, doc } = useDocStore();
  const [textValue, setTextValue] = useState(element.text);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleTypeChange = (newType: ElementType) => {
    updateElementType(element.id, newType, element.heading_level || 1, textValue);
  };

  const handleLevelChange = (lvl: number) => {
    updateElementType(element.id, element.type, lvl, textValue);
  };

  const handleTextBlur = () => {
    if (textValue !== element.text) {
      updateElementType(element.id, element.type, element.heading_level || 1, textValue);
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
    // Mark as needing review by lowering confidence
    if (doc) {
      updateElementType(element.id, 'unknown', undefined, element.text);
    }
  };

  return (
    <>
      <div
        className="element-card"
        onContextMenu={handleContextMenu}
      >
        {/* Header: grip + type select + level select + badge */}
        <div className="element-card-header">
          {showGrip && (
            <span className="element-card-grip" title="Arrastrar para reordenar">
              <GripVertical size={16} strokeWidth={2} />
            </span>
          )}

          <select
            className="element-card-type-select"
            value={element.type}
            onChange={(e) => handleTypeChange(e.target.value as ElementType)}
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
            >
              {HEADING_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
              ))}
            </select>
          )}

          <ConfidenceBadge
            confidence={element.confidence}
            isUserModified={element.is_user_modified}
          />
        </div>

        {/* Text area (non-media elements) */}
        {element.type !== 'image' && element.type !== 'table' && (
          <textarea
            className="element-card-textarea"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={handleTextBlur}
            rows={Math.min(Math.max(Math.ceil(textValue.length / 80), 2), 6)}
          />
        )}

        {/* Image preview */}
        {element.type === 'image' && element.image_info && (
          <div className="element-card-image-preview">
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
              <p className="text-xs text-tertiary">
                {element.image_info.filename}
              </p>
            </div>
          </div>
        )}

        {/* Table info */}
        {element.type === 'table' && element.table_info && (
          <div className="element-card-table-info">
            <p className="text-sm font-semibold">
              Tabla {element.table_info.table_number}
            </p>
            <p className="text-xs text-tertiary">
              {element.table_info.headers.length} columnas, {element.table_info.rows.length} filas
            </p>
          </div>
        )}
      </div>

      {/* Context Menu (rendered in portal) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          elementId={element.id}
          currentType={element.type}
          onClose={() => setContextMenu(null)}
          onChangeType={(type, headingLevel) => {
            updateElementType(element.id, type, headingLevel || 1, textValue);
          }}
          onAcceptClassification={handleAcceptClassification}
          onMarkForReview={handleMarkForReview}
        />
      )}
    </>
  );
};
