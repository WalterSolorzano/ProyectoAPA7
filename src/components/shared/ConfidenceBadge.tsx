/* WordAPA7 — Confidence Badge (colored dot + percentage, Fluent Design) */

import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number;
  isUserModified?: boolean;
}

function getBadgeClass(confidence: number, isUserModified?: boolean): string {
  if (isUserModified) return 'confidence-badge confidence-badge-manual';
  if (confidence >= 0.85) return 'confidence-badge confidence-badge-green';
  if (confidence >= 0.70) return 'confidence-badge confidence-badge-yellow';
  return 'confidence-badge confidence-badge-red';
}

function getLabel(confidence: number, isUserModified?: boolean): string {
  if (isUserModified) return 'Manual (100%)';
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.85) return `Alta (${pct}%)`;
  if (confidence >= 0.70) return `Media (${pct}%)`;
  return `Baja (${pct}%)`;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  isUserModified,
}) => {
  const badgeClass = getBadgeClass(confidence, isUserModified);
  const label = getLabel(confidence, isUserModified);

  return (
    <span className={badgeClass}>
      <span className="confidence-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
};
