/* WordAPA7 — Mini-mapa del documento (DocumentOutline).
   Navegación rápida por títulos en documentos largos, sin scroll infinito.
   Cada clic hace scroll suave al título dentro de PaperCanvas y lo selecciona. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';

const isRefHeading = (txt: string): boolean => {
  const n = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^(referencias?|bibliografia|obras consultadas|works cited)\b/.test(n.trim());
};

export const DocumentOutline: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setWizardStep = useDocStore((s) => s.setWizardStep);

  if (!doc) return null;

  const headings = doc.elements.filter(
    (e) => e.type === 'heading' && !e.is_cover_section && !isRefHeading(e.text || ''),
  );

  if (headings.length === 0) return null;

  const goTo = (id: string) => {
    setSelectedElementId(id);
    // Asegura una vista que muestre el documento completo (Cuerpo o posterior).
    const step = useDocStore.getState().wizardStep;
    if (step < 2 || step > 5) setWizardStep(4);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px', gap: '2px' }}>
      {headings.slice(0, 80).map((h) => {
        const level = h.heading_level || 1;
        const isActive = h.id === selectedElementId;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => goTo(h.id)}
            title={h.text || ''}
            style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              border: 'none', background: 'transparent', fontFamily: 'inherit',
              padding: '4px 6px', paddingLeft: `${6 + Math.max(0, level - 1) * 12}px`,
              borderRadius: '6px', fontSize: '11px', lineHeight: 1.35,
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: isActive ? 700 : 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-subtle)'; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            {level <= 1 ? (h.text || '').replace(/^\d+[\.\)]?\s*/, '') : (h.text || '')}
          </button>
        );
      })}
    </div>
  );
};

export default DocumentOutline;
