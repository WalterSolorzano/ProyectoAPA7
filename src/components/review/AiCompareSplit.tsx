/* WordAPA7 — Split-comparador de la sala de IA (fase 5).
   Robado del workbench de la rama feat (`AiHierarchy.tsx`), adaptado a la
   arquitectura de la puerta/recorrido/sala: dos columnas lado a lado, el texto
   original con la fórmula LLM detectada y la propuesta con voz de autor humano.

   Reglas que este componente NO negocia (AGENTS.md §1):
   - El detector de IA es PROBABILÍSTICO: propone, la persona decide. Nunca hay
     botón "Aceptar"; la acción es "Marcar para revisar" y, si la persona editó
     la propuesta, "Reemplazar en Manuscrito".
   - Cero emojis; solo tokens CSS (alias legacy del design system + tokens
     declarados `--color-*`).
   - Si el hallazgo no es de IA, no se pinta (el split no tiene sentido). */
import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Copy } from 'lucide-react';
import type { AuditItem } from '../../lib/auditItems';

interface Props {
  item: AuditItem;
  onMark?: (id: string) => void;
  onReplace?: (id: string, text: string) => void;
}

export const AiCompareSplit: React.FC<Props> = ({ item, onMark, onReplace }) => {
  const [proposal, setProposal] = useState(item.suggestedText ?? item.originalText ?? '');
  const [copied, setCopied] = useState(false);

  /* Si cambia el hallazgo (navegación entre segmentos), la propuesta editable
     vuelve a partir de la sugerencia del nuevo hallazgo. */
  useEffect(() => {
    setProposal(item.suggestedText ?? item.originalText ?? '');
    setCopied(false);
  }, [item.id, item.suggestedText, item.originalText]);

  if (item.category !== 'ai') return null;

  const canReplace = Boolean(onReplace) && proposal.trim().length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(proposal);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div data-testid="ai-compare-split" style={wrap}>
      {/* Columna izquierda: texto original con la fórmula LLM detectada */}
      <div style={leftCol}>
        <span style={labelDanger}>Texto Original (Fórmula LLM Detectada)</span>
        <div style={originalBody}>
          <span style={originalMark}>{item.originalText}</span>
        </div>
        {item.detail && <div style={detail}>{item.detail}</div>}
      </div>

      {/* Columna derecha: propuesta con voz de autor humano, editable */}
      <div style={rightCol}>
        <div style={rightHead}>
          <span style={labelSuccess}>Propuesta con Voz de Autor Humano</span>
          <span style={editableTag}>Editable</span>
        </div>
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          rows={4}
          aria-label="Propuesta con Voz de Autor Humano"
          style={textarea}
        />
      </div>

      {/* Barra de acciones: solo marcar / reemplazar, nunca aceptar */}
      <div style={actions}>
        <button type="button" onClick={handleCopy} style={btnGhost}>
          <Copy size={13} strokeWidth={1.75} aria-hidden />
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        {onMark && (
          <button type="button" onClick={() => onMark(item.id)} style={btnGhost}>
            <Bookmark size={13} strokeWidth={1.75} aria-hidden />
            Marcar para revisar
          </button>
        )}
        {onReplace && (
          <button
            type="button"
            disabled={!canReplace}
            onClick={() => onReplace(item.id, proposal.trim())}
            style={{ ...btnSolid, opacity: canReplace ? 1 : 0.5, cursor: canReplace ? 'pointer' : 'default' }}
          >
            <Check size={13} strokeWidth={1.75} aria-hidden />
            Reemplazar en Manuscrito
          </button>
        )}
      </div>
    </div>
  );
};

const wrap: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: 'var(--paper-white)',
};
const leftCol: React.CSSProperties = {
  padding: '12px 14px',
  borderRight: '1px solid var(--border-subtle)',
  background: 'var(--paper-white)',
};
const rightCol: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--color-success-a12)',
  display: 'flex',
  flexDirection: 'column',
};
const rightHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const labelDanger: React.CSSProperties = {
  fontSize: '10px', fontWeight: 800, color: 'var(--color-danger)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const labelSuccess: React.CSSProperties = {
  fontSize: '10px', fontWeight: 800, color: 'var(--color-success)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const editableTag: React.CSSProperties = { fontSize: '10px', color: 'var(--text-secondary)' };
const originalBody: React.CSSProperties = {
  fontSize: '13.5px', lineHeight: 1.75, color: 'var(--text-main)', marginTop: '8px',
};
const originalMark: React.CSSProperties = {
  background: 'var(--mark-ai-bg)',
  borderBottom: '2px dashed var(--text-secondary)',
  padding: '1px 2px',
};
const detail: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '10px', fontStyle: 'italic',
};
const textarea: React.CSSProperties = {
  marginTop: '8px', width: '100%', padding: '6px 10px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  background: 'var(--paper-white)', color: 'var(--text-main)',
  fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.6,
  resize: 'vertical', boxSizing: 'border-box',
};
const actions: React.CSSProperties = {
  padding: '10px 12px', background: 'var(--canvas-bg)',
  display: 'flex', flexDirection: 'column', justifyContent: 'center',
  gap: '6px', borderLeft: '1px solid var(--border-subtle)',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 700,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnSolid: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--accent-primary)', color: 'var(--color-text-on-accent)',
  fontSize: 'var(--text-xs)', fontWeight: 800, whiteSpace: 'nowrap',
};

export default AiCompareSplit;
