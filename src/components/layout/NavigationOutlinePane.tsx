/* WordAPA7 — Navigation Outline Pane (Headings Tree + Right-Click Context Menu) */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ChevronDown, ChevronRight, Heading, FileText, List, BookOpen, Eye, EyeOff } from 'lucide-react';

interface OutlineNode {
  id: string;
  level: number;
  text: string;
  children: OutlineNode[];
}

function filterTree(nodes: OutlineNode[], query: string): OutlineNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce<OutlineNode[]>((acc, node) => {
    const children = filterTree(node.children, query);
    if (node.text.toLowerCase().includes(q) || children.length > 0) {
      acc.push({ ...node, children });
    }
    return acc;
  }, []);
}

function buildOutlineTree(elements: any[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: { node: OutlineNode; level: number }[] = [];

  for (const elem of elements) {
    if (elem.type !== 'heading' || !elem.heading_level) continue;
    const level = elem.heading_level;
    const node: OutlineNode = {
      id: elem.id,
      level,
      text: elem.text || '(Sin título)',
      children: [],
    };

    // Pop stack until we find the right parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, level });
  }

  return root;
}

interface OutlineItemProps {
  node: OutlineNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

const OutlineItem: React.FC<OutlineItemProps> = ({ node, selectedId, onSelect, depth = 0 }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    onSelect(node.id);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 8px',
          paddingLeft: `${12 + depth * 16}px`,
          cursor: 'pointer',
          borderRadius: '4px',
          backgroundColor: isSelected ? 'rgba(124,92,252,0.1)' : 'transparent',
          color: isSelected ? 'var(--accent-primary)' : 'inherit',
          transition: 'background 0.1s ease',
          fontSize: '12px',
          fontWeight: depth === 0 ? 600 : 400,
          borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
        }}
        onMouseOver={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(124,92,252,0.1)';
        }}
        onMouseOut={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Dispatch custom event for context menu
          const event = new CustomEvent('outline-context-menu', {
            bubbles: true,
            detail: { elementId: node.id, x: e.clientX, y: e.clientY },
          });
          document.dispatchEvent(event);
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span style={{ width: '12px', flexShrink: 0 }} />
        )}

        {depth === 0 ? (
          <Heading size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
        ) : depth === 1 ? (
          <FileText size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
        ) : (
          <List size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
        )}

        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {node.text}
        </span>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <OutlineItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  elementId: string | null;
}

export const NavigationOutlinePane: React.FC = () => {
  const { doc, selectedElementId, setSelectedElementId } = useDocStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tree, setTree] = useState<OutlineNode[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, elementId: null,
  });
  const contextRef = useRef<HTMLDivElement>(null);

  // Build tree from document elements
  useEffect(() => {
    if (doc) {
      setTree(buildOutlineTree(doc.elements));
    } else {
      setTree([]);
    }
  }, [doc]);

  // Listen for context menu events from outline items
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setContextMenu({ visible: true, x: detail.x, y: detail.y, elementId: detail.elementId });
      }
    };
    document.addEventListener('outline-context-menu', handler);
    return () => document.removeEventListener('outline-context-menu', handler);
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible]);

  const handleSelect = useCallback((id: string) => {
    setSelectedElementId(id);
  }, [setSelectedElementId]);

  const handleContextAction = useCallback((action: string) => {
    const { elementId } = contextMenu;
    if (!elementId || !doc) return;

    const store = useDocStore.getState();

    switch (action) {
      case 'enumerate-roman': {
        const updatedElements = doc.elements.map((e) => {
          if (e.id === elementId && e.type === 'heading' && e.heading_level === 1) {
            return { ...e, text: `[ROMAN] ${e.text}` };
          }
          return e;
        });
        const updatedDoc = { ...doc, elements: updatedElements };
        store.pushHistory(updatedDoc);
        useDocStore.setState({ doc: updatedDoc });
        break;
      }
      case 'enumerate-decimal': {
        const updatedElements = doc.elements.map((e) => {
          if (e.id === elementId && e.type === 'heading' && e.heading_level === 1) {
            return { ...e, text: `[DECIMAL] ${e.text}` };
          }
          return e;
        });
        const updatedDoc = { ...doc, elements: updatedElements };
        store.pushHistory(updatedDoc);
        useDocStore.setState({ doc: updatedDoc });
        break;
      }
      case 'force-page-break': {
        // Page break enforcement is done at generation time;
        // we store a marker on the element for the generator
        const updatedElements = doc.elements.map((e) => {
          if (e.id === elementId) {
            return { ...e, original_text: (e.original_text || e.text) + ' [PAGE_BREAK]' };
          }
          return e;
        });
        const updatedDoc = { ...doc, elements: updatedElements };
        store.pushHistory(updatedDoc);
        useDocStore.setState({ doc: updatedDoc });
        break;
      }
      case 'mark-h1':
        store.updateElementType(elementId, 'heading', 1);
        break;
      case 'mark-h2':
        store.updateElementType(elementId, 'heading', 2);
        break;
      case 'mark-h3':
        store.updateElementType(elementId, 'heading', 3);
        break;
    }

    setContextMenu({ visible: false, x: 0, y: 0, elementId: null });
  }, [contextMenu, doc]);

  if (!doc) return null;

  // Collapsed state
  if (isCollapsed) {
    return (
      <div
        onClick={() => setIsCollapsed(false)}
        style={{
          width: '36px',
          minWidth: '36px',
          backgroundColor: 'var(--sidebar-bg)',
          color: 'var(--text-main)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          cursor: 'pointer',
        }}
        title="Mostrar Esquema de Navegación"
      >
        <button
          className="btn btn-secondary btn-xs"
          style={{ padding: '6px', borderRadius: '50%' }}
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}
        >
          <Eye size={14} color="var(--word-blue, #1a73e8)" />
        </button>
        <span style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          marginTop: '16px',
          letterSpacing: '1px',
        }}>
          ESQUEMA
        </span>
      </div>
    );
  }

  const headingCount = doc.elements.filter((e) => e.type === 'heading').length;
  const h1Count = doc.elements.filter((e) => e.type === 'heading' && e.heading_level === 1).length;

  return (
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        backgroundColor: 'var(--sidebar-bg)',
        color: 'var(--text-main)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BookOpen size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            NAVEGACIÓN
          </span>
          <span style={{
            fontSize: '10px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: 'var(--text-muted)',
            padding: '1px 6px',
            borderRadius: '10px',
          }}>
            {headingCount}
          </span>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          title="Ocultar esquema"
        >
          <EyeOff size={12} />
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <input
          type="text"
          placeholder="Buscar títulos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-main)',
            outline: 'none',
          }}
        />
      </div>

      {/* Stats bar / Legend */}
      <div style={{
        padding: '6px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        fontSize: '10px',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(124,92,252,0.15)', color: '#9b79ff' }}>H1</span>
          ({h1Count})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(6,214,160,0.15)', color: '#06d6a0' }}>H2</span>
          ({doc.elements.filter((e) => e.type === 'heading' && e.heading_level === 2).length})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>H3</span>
          ({doc.elements.filter((e) => e.type === 'heading' && e.heading_level === 3).length})
        </span>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
        {tree.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#94a3b8',
          }}>
            No se detectaron títulos en el documento.
            <br />
            Los títulos aparecerán aquí después de la clasificación.
          </div>
        ) : (
          filterTree(tree, searchQuery).map((node) => (
            <OutlineItem
              key={node.id}
              node={node}
              selectedId={selectedElementId}
              onSelect={handleSelect}
              depth={0}
            />
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 9999,
            minWidth: '220px',
            padding: '4px',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Numeración
          </div>
          <ContextMenuItem label="Enumerar Títulos Nivel 1 con números romanos (I, II, III...)" onClick={() => handleContextAction('enumerate-roman')} />
          <ContextMenuItem label="Enumerar con números decimales (1, 2, 3...)" onClick={() => handleContextAction('enumerate-decimal')} />

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

          <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Formato
          </div>
          <ContextMenuItem label="Forzar salto de página antes de este heading" onClick={() => handleContextAction('force-page-break')} />

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

          <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tipo de Título
          </div>
          <ContextMenuItem label="Marcar como Título Nivel 1" onClick={() => handleContextAction('mark-h1')} />
          <ContextMenuItem label="Marcar como Título Nivel 2" onClick={() => handleContextAction('mark-h2')} />
          <ContextMenuItem label="Marcar como Título Nivel 3" onClick={() => handleContextAction('mark-h3')} />
        </div>
      )}
    </div>
  );
};

/* Context menu item sub-component */
const ContextMenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '8px 10px',
      fontSize: '12px',
      color: '#334155',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'background 0.1s ease',
    }}
    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f1f5f9'; }}
    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
  >
    {label}
  </div>
);

export default NavigationOutlinePane;
