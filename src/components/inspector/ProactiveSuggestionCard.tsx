import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  RotateCcw,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { fetchProactiveElementDiagnosis } from '../../api/backend';

export const ProactiveSuggestionCard: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const updateElementType = useDocStore((s) => s.updateElementType);
  const showToast = useDocStore((s) => s.showToast);

  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<{
    element_id: string;
    type: string;
    diagnosis: string;
    original_text: string;
    proposed_text: string;
    action_type: string;
    new_type?: string;
  } | null>(null);

  useEffect(() => {
    if (!doc || !selectedElementId) {
      setProposal(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetchProactiveElementDiagnosis(doc.session_id, selectedElementId)
      .then((res) => {
        if (active) {
          setProposal(res.proposal || null);
        }
      })
      .catch(() => {
        if (active) setProposal(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [doc?.session_id, selectedElementId]);

  if (!selectedElementId || (!loading && !proposal)) return null;

  const handleApply = () => {
    if (!proposal || !selectedElementId) return;

    if (proposal.action_type === 'update_text' && proposal.proposed_text) {
      updateElementText(selectedElementId, proposal.proposed_text);
      showToast('Corrección APA 7 aplicada al documento', 'success');
    } else if (proposal.action_type === 'set_type' && proposal.new_type) {
      updateElementType(selectedElementId, proposal.new_type as any, 1);
      showToast(`Formato cambiado a ${proposal.new_type}`, 'success');
    }

    setProposal(null);
  };

  return (
    <div
      style={{
        margin: '12px',
        padding: '14px',
        backgroundColor: 'var(--surface-elevated, #ffffff)',
        border: '1px solid var(--border-subtle, #e5e7eb)',
        borderLeft: '3px solid var(--accent-primary, #4f7cff)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-primary, #4f7cff)', letterSpacing: '0.04em' }}>
          <Sparkles size={13} />
          <span>Diagnóstico Proactivo APA 7</span>
        </div>
        {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-secondary, #6b7280)' }} />}
      </div>

      {proposal && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--text-main, #1a1a2e)', lineHeight: 1.45 }}>
            {proposal.diagnosis}
          </div>

          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--surface-subtle, #f9fafb)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              fontSize: '11px',
              color: 'var(--text-secondary, #4b5563)',
              fontStyle: 'italic',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
          >
            "{proposal.proposed_text}"
          </div>

          <button
            type="button"
            onClick={handleApply}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary, #4f7cff)',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Check size={14} strokeWidth={3} />
            <span>Aplicar sugerencia</span>
          </button>
        </>
      )}
    </div>
  );
};
