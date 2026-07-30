/* WordAPA7 — Confidence Badge (Iconos + Tooltip Explicativo) */

import React, { useState } from 'react';

interface ConfidenceBadgeProps {
  confidence: number;
  isUserModified?: boolean;
  llmReasoning?: string | null;
  preClassifierRule?: string | null;
}

function getConfidenceLabel(confidence: number, isUserModified?: boolean): {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  tooltip: string;
} {
  if (isUserModified) {
    return {
      label: 'Modificado',
      icon: '✏️',
      bgColor: '#fef3c7',
      textColor: '#b45309',
      borderColor: '#fde68a',
      tooltip: 'Has editado este elemento manualmente. El sistema respeta tus cambios.',
    };
  }

  if (confidence >= 0.95) {
    return {
      label: 'Confianza Máxima',
      icon: '✅',
      bgColor: '#dcfce7',
      textColor: '#15803d',
      borderColor: '#bbf7d0',
      tooltip: 'Clasificación automática con muy alta precisión. No requiere revisión.',
    };
  }

  if (confidence >= 0.85) {
    return {
      label: 'Confianza Alta',
      icon: '✅',
      bgColor: '#e6f4e6',
      textColor: '#166534',
      borderColor: '#a7f3d0',
      tooltip: 'Clasificado con alta seguridad. Recomendado verificar solo si el contexto lo amerita.',
    };
  }

  if (confidence >= 0.7) {
    return {
      label: 'Confianza Media',
      icon: '⚠️',
      bgColor: '#fef9e7',
      textColor: '#8a6d00',
      borderColor: '#f0d78c',
      tooltip: 'Clasificación moderada. Se recomienda revisar para confirmar la categoría correcta.',
    };
  }

  return {
    label: 'Requiere Revisión',
    icon: '❌',
    bgColor: '#fee2e2',
    textColor: '#dc2626',
    borderColor: '#fca5a5',
    tooltip: 'Clasificación incierta. Por favor revisa y asigna el tipo correcto manualmente.',
  };
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  isUserModified,
  llmReasoning,
  preClassifierRule,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const info = getConfidenceLabel(confidence, isUserModified);

  // Construir tooltip detallado
  const detailedTooltip = [
    info.tooltip,
    `Confianza: ${Math.round(confidence * 100)}%`,
    preClassifierRule ? `Regla: ${preClassifierRule}` : '',
    llmReasoning ? `Razon LLM: ${llmReasoning}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        backgroundColor: info.bgColor,
        color: info.textColor,
        padding: '2px 8px',
        borderRadius: '4px',
        border: `1px solid ${info.borderColor}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'default',
        position: 'relative',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={detailedTooltip}
    >
      <span style={{ fontSize: '12px', lineHeight: 1 }}>{info.icon}</span>
      <span>{info.label}</span>

      {/* Tooltip flotante */}
      {showTooltip && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            fontSize: '10px',
            padding: '6px 10px',
            borderRadius: '6px',
            maxWidth: '260px',
            whiteSpace: 'normal',
            lineHeight: 1.4,
            zIndex: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {detailedTooltip}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '5px solid transparent',
              borderTopColor: '#1e293b',
            }}
          />
        </span>
      )}
    </span>
  );
};
