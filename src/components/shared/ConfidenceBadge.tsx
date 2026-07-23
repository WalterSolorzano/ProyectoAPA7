/* WordAPA7 — Confidence Badge (Etiquetas de Estado Claras: Revisar / Correcto / Modificado) */

import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number;
  isUserModified?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  isUserModified,
}) => {
  if (isUserModified) {
    return (
      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        backgroundColor: '#fef3c7',
        color: '#b45309',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid #fde68a'
      }}>
        ✏️ Modificado
      </span>
    );
  }

  if (confidence >= 0.85) {
    return (
      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        backgroundColor: '#dcfce7',
        color: '#15803d',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid #bbf7d0'
      }}>
        ✓ Correcto
      </span>
    );
  }

  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      backgroundColor: '#fee2e2',
      color: '#dc2626',
      padding: '2px 6px',
      borderRadius: '4px',
      border: '1px solid #fca5a5'
    }}>
      ⚠️ Revisar
    </span>
  );
};
