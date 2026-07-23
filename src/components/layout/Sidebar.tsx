/* WordAPA7 — Sidebar (deprecated — replaced by DocumentOutlinePane) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { FileText, BookOpen, Settings, ShieldCheck } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useDocStore();

  const navItems = [
    { id: 'classifier' as const, label: 'Estructura y Titulos', icon: FileText },
    { id: 'portada' as const, label: 'Portada APA 7', icon: BookOpen },
    { id: 'referencias' as const, label: 'Referencias', icon: BookOpen },
    { id: 'rules' as const, label: 'Fuente y Formatos', icon: Settings },
    { id: 'validator' as const, label: 'Validador Citas', icon: ShieldCheck },
  ];

  return (
    <aside className="nav-pane">
      <div className="nav-pane-tabs">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-tab-btn${isActive ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-tab-icon">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
