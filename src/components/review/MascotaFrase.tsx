import React from 'react';
import { EditorialMascot, type MascotExpression, type MascotKind } from '../layout/EditorialMascot';

export interface MascotaFraseProps {
  frase: string;
  kind?: MascotKind;
  expression?: MascotExpression;
  size?: number;
}

/** Mascota + globo con la frase de la banda. La frase la decide `mascotaFrases`;
 *  este componente solo la pinta. Sin frase no ocupa lugar. */
export const MascotaFrase: React.FC<MascotaFraseProps> = ({
  frase,
  kind = 'reference',
  expression = 'neutral',
  size = 56,
}) => {
  if (!frase) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
      <EditorialMascot kind={kind} expression={expression} size={size} />
      <p
        role="note"
        style={{
          margin: 0,
          maxWidth: '34ch',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.4,
          color: 'var(--color-text-secondary)',
        }}
      >
        {frase}
      </p>
    </div>
  );
};

export default MascotaFrase;
