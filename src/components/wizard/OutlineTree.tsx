/* WordAPA7 — OutlineTree: mapa jerárquico de títulos (única implementación).
   Usado por el paso 2 (Estructura, con toolbar) y por el Mapa del documento
   (RightSidePanel / DocumentOutline). Click navega y selecciona el título. */

import React, { useMemo, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ChevronRight, ChevronDown, FoldVertical, Bookmark } from 'lucide-react';

const isRefHeading = (txt: string): boolean => {
  const n = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /^(referencias?|bibliografia|obras consultadas|works cited)\b/.test(n.trim());
};

type HeadingElem = { id: string; text?: string; heading_level?: number | null };

export const OutlineTree: React.FC<{ showToolbar?: boolean }> = ({ showToolbar = false }) => {
  const doc = useDocStore((s) => s.doc);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    // Por defecto se muestran los títulos de nivel 1 (raíces); los hijos
    // (nivel 2, 3...) arrancan colapsados para no saturar la vista.
    const d = useDocStore.getState().doc;
    const ids = (d?.elements || [])
      .filter((e) => e.type === 'heading' && e.heading_level && e.heading_level > 1)
      .map((e) => e.id);
    return new Set(ids);
  });

  const headings = useMemo(
    () =>
      ((doc?.elements || []) as unknown as HeadingElem[]).filter(
        (e) => (e as any).type === 'heading' && !(e as any).is_cover_section && !isRefHeading(e.text || ''),
      ),
    [doc],
  );

  // Construir árbol jerárquico de títulos: hijos = headings con nivel > padre
  // que no hayan sido "cerrados" por un heading de nivel igual o menor.
  const outlineTree = useMemo(() => {
    type Node = { elem: HeadingElem; children: Node[] };
    const root: Node[] = [];
    const stack: Node[] = [];
    for (const h of headings) {
      const lvl = h.heading_level || 1;
      const node: Node = { elem: h, children: [] };
      while (stack.length && (stack[stack.length - 1].elem.heading_level || 1) >= lvl) {
        stack.pop();
      }
      if (stack.length) {
        stack[stack.length - 1].children.push(node);
      } else {
        root.push(node);
      }
      stack.push(node);
    }
    return root;
  }, [headings]);

  const toggleNode = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const nav = (id: string) => {
    setSelectedElementId(id);
    // Asegura una vista que muestre el documento completo (Cuerpo o posterior).
    const step = useDocStore.getState().wizardStep;
    if (step < 2 || step > 5) useDocStore.getState().setWizardStep(4);
    document.getElementById(`paper-elem-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderNode = (node: { elem: HeadingElem; children: unknown[] }, depth: number): React.ReactNode => {
    const h = node.elem;
    const lvl = h.heading_level || 1;
    const lvlColor = lvl === 1 ? 'var(--accent-primary)' : lvl === 2 ? 'var(--accent-secondary)' : 'var(--color-text-tertiary)';
    const isSelected = selectedElementId === h.id;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(h.id);
    return (
      <div key={h.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => nav(h.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav(h.id); } }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
            padding: '5px 8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            background: isSelected ? 'var(--accent-soft)' : 'transparent',
            border: 'none',
            borderLeft: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
            borderRadius: 'var(--radius-sm)',
            color: isSelected ? 'var(--accent-primary)' : 'var(--color-text-primary)',
            paddingLeft: 4 + (depth - 1) * 14,
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleNode(h.id); }}
              title={isCollapsed ? 'Expandir sección' : 'Colapsar sección'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          ) : (
            <span style={{ width: 16, flexShrink: 0 }} />
          )}
          <span style={{
            flexShrink: 0, fontSize: '9px', fontWeight: 700, minWidth: '22px', textAlign: 'center',
            padding: '1px 4px', borderRadius: 4,
            backgroundColor: lvl === 1 ? 'var(--color-accent-soft)' : 'transparent',
            color: lvlColor,
          }}>
            H{lvl}
          </span>
          <span style={{
            flex: 1, fontSize: lvl === 1 ? '12px' : '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontWeight: lvl === 1 ? 700 : 500,
          }}>
            {(h.text || '').trim()}
          </span>
          {hasChildren && (
            <span style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
              {node.children.length}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div style={{ marginLeft: 10 }}>
            {node.children.map((c) => renderNode(c as never, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {showToolbar && headings.length > 0 && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set())}
            style={{ flex: 1, fontSize: '10px', padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)' }}
          >
            Expandir todo
          </button>
          <button
            type="button"
            onClick={() => setCollapsedNodes(new Set(headings.filter((h) => h.heading_level && h.heading_level > 1).map((h) => h.id)))}
            style={{ flex: 1, fontSize: '10px', padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
          >
            <FoldVertical size={11} /> Solo nivel 1
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {headings.length === 0 && (
          <div style={{
            padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)',
            fontSize: '11.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          }}>
            <Bookmark size={18} color="var(--text-muted)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Sin títulos detectados</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Hacé clic sobre cualquier párrafo en el documento para asignarle nivel H1, H2 o H3.
            </span>
          </div>
        )}
        {outlineTree.map((node) => renderNode(node, 1))}
      </div>
    </>
  );
};

export default OutlineTree;
