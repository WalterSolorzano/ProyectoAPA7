/* WordAPA7 — Mascota SVG con expresiones.
 * Una hoja de papel (documento) con cara — inconfundible, no es un pin.
 * Cambia de expresión según la salud del documento.
 */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';

export type MascotExpression = 'neutral' | 'happy' | 'excited' | 'curious' | 'worried';

/** Calcula la expresión según el estado real del documento. */
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

export const DocumentMascot: React.FC<MascotProps> = ({ size = 52, expression }) => {
  const ghostCount = useDocStore((s) => s.citationAuditResult?.ghost_citations?.length || 0);
  const orphanCount = useDocStore((s) => s.citationAuditResult?.orphan_references?.length || 0);
  const issues = useDocStore((s) => s.validationIssues || []);
  const elements = useDocStore((s) => s.doc?.elements || []);

  const problems = ghostCount + orphanCount +
    issues.filter((i: any) => i.severity === 'error' || i.status === 'error').length +
    elements.filter((e) => (e.ai_score || 0) >= 0.5).length;

  const expr: MascotExpression = expression || (problems === 0 ? (elements.length >= 10 ? 'excited' : 'happy') : problems <= 3 ? 'curious' : 'worried');

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
      {/* Hoja de papel (documento) */}
      <rect x="6" y="6" width="46" height="52" rx="4" fill="#FFCC80" stroke="#E65100" strokeWidth="2" />
      {/* Esquina doblada */}
      <path d="M52 6 V16 L42 6 Z" fill="#FFE0B2" stroke="#E65100" strokeWidth="2" />
      {/* Líneas de texto */}
      <rect x="14" y="16" width="30" height="2.5" rx="1.2" fill="#E65100" opacity="0.3" />
      <rect x="14" y="22" width="25" height="2.5" rx="1.2" fill="#E65100" opacity="0.3" />
      <rect x="14" y="28" width="28" height="2.5" rx="1.2" fill="#E65100" opacity="0.3" />
      <rect x="14" y="34" width="18" height="2.5" rx="1.2" fill="#E65100" opacity="0.2" />

      {/* Cara (no rotada, sobre el documento) */}
      {/* Mejillas */}
      <ellipse cx="22" cy="46" rx="4" ry="2.4" fill="#FFE0B2" opacity="0.9" />
      <ellipse cx="42" cy="46" rx="4" ry="2.4" fill="#FFE0B2" opacity="0.9" />

      {/* Ojos y boca según expresión */}
      {expr === 'happy' || expr === 'excited' || expr === 'neutral' ? (
        <>
          <circle cx="26" cy="44" r="2.6" fill="#4E342E" className="doc-mascot-eye" />
          <circle cx="38" cy="44" r="2.6" fill="#4E342E" className="doc-mascot-eye" />
          <circle cx="27" cy="43.2" r="0.9" fill="#ffffff" opacity="0.8" />
          <circle cx="39" cy="43.2" r="0.9" fill="#ffffff" opacity="0.8" />
        </>
      ) : expr === 'curious' ? (
        <>
          <circle cx="26" cy="44" r="2.6" fill="#4E342E" className="doc-mascot-eye" />
          <circle cx="27" cy="43.2" r="0.9" fill="#ffffff" opacity="0.8" />
          <circle cx="39" cy="42" r="3.6" fill="#4E342E" className="doc-mascot-eye" />
          <circle cx="39" cy="41" r="1.4" fill="#ffffff" />
        </>
      ) : (
        <>
          <circle cx="26" cy="45" r="2.6" fill="#4E342E" className="doc-mascot-eye" />
          <circle cx="38" cy="45" r="2.6" fill="#4E342E" className="doc-mascot-eye" />
          <path d="M20 39 Q24 37 28 39" stroke="#4E342E" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M36 39 Q40 37 44 39" stroke="#4E342E" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* Boca */}
      {expr === 'happy' && (
        <path d="M27 51 Q32 55 37 51" stroke="#4E342E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {expr === 'excited' && (
        <path d="M26 49 Q32 56 38 49 Q32 52 26 49Z" fill="#4E342E" />
      )}
      {expr === 'neutral' && (
        <path d="M28 52 H36" stroke="#4E342E" strokeWidth="2.5" strokeLinecap="round" />
      )}
      {expr === 'curious' && (
        <circle cx="32" cy="51" r="3" stroke="#4E342E" strokeWidth="2.2" fill="none" />
      )}
      {expr === 'worried' && (
        <path d="M27 54 Q32 50 37 54" stroke="#4E342E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}

      {/* Lágrima */}
      {expr === 'worried' && (
        <path d="M32 54 c1.8 3 3.5 5.5 3.5 5.5 s1.7 -2.5 3.5 -5.5 c-2 -2 -5 -2 -7 0z" fill="#60a5fa" opacity="0.9" />
      )}
    </svg>
  );
};

export default DocumentMascot;
