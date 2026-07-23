/* WordAPA7 — Right-Click Context Menu (Windows 11 Fluent Design) */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ElementType } from '../../types';
import {
  Heading1, Heading2, Heading3, Heading4, Heading5,
  Pilcrow, List, ListOrdered, Quote, Image, Table2,
  CheckCircle, AlertTriangle,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  elementId: string;
  currentType: ElementType;
  onClose: () => void;
  onChangeType: (type: ElementType, headingLevel?: number) => void;
  onAcceptClassification: () => void;
  onMarkForReview: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  children?: MenuItem[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  currentType,
  onChangeType,
  onClose,
  onAcceptClassification,
  onMarkForReview,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = React.useState<string | null>(null);
  const [adjustedPos, setAdjustedPos] = React.useState({ x, y });

  // Adjust position to stay within viewport
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    let adjX = x;
    let adjY = y;
    if (rect.right > window.innerWidth) adjX = x - rect.width;
    if (rect.bottom > window.innerHeight) adjY = y - rect.height;
    if (adjX < 0) adjX = 4;
    if (adjY < 0) adjY = 4;
    setAdjustedPos({ x: adjX, y: adjY });
  }, [x, y]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay listener to avoid immediate close from same click
    const timer = setTimeout(() => {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const menuItems: MenuItem[] = [
    {
      id: 'change-heading',
      label: 'Cambiar a Titulo',
      icon: <Heading1 size={14} />,
      action: () => {},
      children: [
        { id: 'heading-1', label: 'Nivel 1 — Centrado, Negrita', icon: <Heading1 size={14} />, action: () => onChangeType('heading', 1) },
        { id: 'heading-2', label: 'Nivel 2 — Izquierda, Negrita', icon: <Heading2 size={14} />, action: () => onChangeType('heading', 2) },
        { id: 'heading-3', label: 'Nivel 3 — Izquierda, Negrita-Cursiva', icon: <Heading3 size={14} />, action: () => onChangeType('heading', 3) },
        { id: 'heading-4', label: 'Nivel 4 — Sangrado, Negrita', icon: <Heading4 size={14} />, action: () => onChangeType('heading', 4) },
        { id: 'heading-5', label: 'Nivel 5 — Sangrado, Negrita-Cursiva', icon: <Heading5 size={14} />, action: () => onChangeType('heading', 5) },
      ],
    },
    { id: 'change-paragraph', label: 'Cambiar a Parrafo', icon: <Pilcrow size={14} />, action: () => onChangeType('paragraph') },
    { id: 'change-bullet', label: 'Cambiar a Lista con Vinetas', icon: <List size={14} />, action: () => onChangeType('bullet') },
    { id: 'change-numbered', label: 'Cambiar a Lista Numerada', icon: <ListOrdered size={14} />, action: () => onChangeType('numbered_list') },
    { id: 'change-quote', label: 'Cambiar a Cita en Bloque', icon: <Quote size={14} />, action: () => onChangeType('block_quote') },
    { id: 'change-image', label: 'Cambiar a Figura / Imagen', icon: <Image size={14} />, action: () => onChangeType('image') },
    { id: 'change-table', label: 'Cambiar a Tabla', icon: <Table2 size={14} />, action: () => onChangeType('table') },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const isActive = item.id.startsWith('change-') && !item.children && currentType === item.id.replace('change-', '');
    const hasChildren = item.children && item.children.length > 0;

    return (
      <button
        key={item.id}
        className={`context-menu-item${isActive ? ' context-menu-item-active' : ''}`}
        onClick={() => {
          if (item.children) {
            setSubmenuOpen(submenuOpen === item.id ? null : item.id);
          } else {
            item.action();
            onClose();
          }
        }}
        onMouseEnter={() => {
          if (hasChildren) setSubmenuOpen(item.id);
        }}
        onMouseLeave={() => {
          if (hasChildren) setSubmenuOpen(null);
        }}
      >
        <span className="context-menu-item-icon">{item.icon}</span>
        <span className="context-menu-item-label">{item.label}</span>
        {hasChildren && (
          <span className="context-menu-item-arrow">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
        {/* Submenu */}
        {hasChildren && submenuOpen === item.id && (
          <div className="context-submenu">
            {item.children!.map((child) => {
              const childType = child.id.replace('change-', '').replace(/-\d+$/, '');
              const childLevel = child.id.match(/-(\d+)$/)?.[1];
              const isChildActive = childType === 'heading'
                ? currentType === 'heading' && currentType === childType
                : false;
              return (
                <button
                  key={child.id}
                  className={`context-menu-item${isChildActive ? ' context-menu-item-active' : ''}`}
                  onClick={() => {
                    child.action();
                    onClose();
                  }}
                >
                  <span className="context-menu-item-icon">{child.icon}</span>
                  <span className="context-menu-item-label">{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </button>
    );
  };

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {menuItems.map(renderMenuItem)}

      <div className="context-menu-separator" />

      <button className="context-menu-item" onClick={() => { onAcceptClassification(); onClose(); }}>
        <span className="context-menu-item-icon">
          <CheckCircle size={14} />
        </span>
        <span className="context-menu-item-label">Aceptar Clasificacion</span>
      </button>

      <button className="context-menu-item" onClick={() => { onMarkForReview(); onClose(); }}>
        <span className="context-menu-item-icon">
          <AlertTriangle size={14} />
        </span>
        <span className="context-menu-item-label">Marcar para Revision</span>
      </button>
    </div>,
    document.body
  );
};
