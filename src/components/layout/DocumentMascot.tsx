/* WordAPA7 — Icono vectorial de documento elegante sin emojis.
 * Hoja de papel APA 7 estilizada con sello de calidad.
 */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';

export type MascotExpression = 'neutral' | 'happy' | 'excited' | 'curious' | 'worried';

/** Mantiene la firma para compatibilidad pero retorna estado de salud. */
export function getMascotExpression(): MascotExpression {
  const s = useDocStore.getState();
  if (!s.doc || s.doc.elements.length === 0) return 'neutral';

  const ghost = s.citationAuditResult?.ghost_citations?.length || 0;
  const orphan = s.citationAuditResult?.orphan_references?.length || 0;
  const errors = (s.validationIssues || []).filter(
    (i: any) => i.severity === 'error' || i.status === 'error' || i.status === 'ERROR',
  ).length;
  const flagged = s.doc.elements.filter((e) => (e.ai_score || 0) >= 0.5).length;

  const problems = ghost + orphan + errors + flagged;
  if (problems === 0) return s.doc.elements.length >= 10 ? 'excited' : 'happy';
  if (problems <= 3) return 'curious';
  return 'worried';
}

interface MascotProps {
  size?: number;
  expression?: MascotExpression;
}

export const DocumentMascot: React.FC<MascotProps> = ({ size = 44 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Fondo de tarjeta elevado */}
      <rect x="8" y="6" width="48" height="52" rx="8" fill="var(--surface-elevated, #ffffff)" stroke="var(--border-subtle, #e2e8f0)" strokeWidth="2" />
      {/* Esquina doblada */}
      <path d="M44 6 V18 H56" fill="var(--color-accent-soft, #eff6ff)" stroke="var(--accent-primary, #3b82f6)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M44 6 L56 18 H44 V6 Z" fill="var(--accent-primary, #3b82f6)" opacity="0.15" />
      
      {/* Líneas de texto estilo APA 7 */}
      <rect x="16" y="18" width="22" height="3" rx="1.5" fill="var(--accent-primary, #3b82f6)" />
      <rect x="16" y="26" width="32" height="2.5" rx="1.2" fill="var(--text-main, #1e293b)" opacity="0.4" />
      <rect x="16" y="32" width="28" height="2.5" rx="1.2" fill="var(--text-main, #1e293b)" opacity="0.4" />
      <rect x="16" y="38" width="30" height="2.5" rx="1.2" fill="var(--text-main, #1e293b)" opacity="0.4" />
      <rect x="16" y="44" width="20" height="2.5" rx="1.2" fill="var(--accent-primary, #3b82f6)" opacity="0.6" />

      {/* Sello de verificación APA 7 */}
      <circle cx="44" cy="44" r="7" fill="var(--accent-primary, #3b82f6)" />
      <path d="M41 44 L43 46 L47 42" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default DocumentMascot;
