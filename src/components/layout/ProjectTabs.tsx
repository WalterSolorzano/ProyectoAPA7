/* WordAPA7 — Multi-Project Tabs (Fluent Design) */

import React, { useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { X, Plus } from 'lucide-react';

export const ProjectTabs: React.FC = () => {
  const {
    tabs, activeTabIndex,
    switchToTab, removeTab, uploadFile, isLoading,
  } = useDocStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (tabs.length === 0) return null;

  const handleNewTab = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    }
  };

  return (
    <div className="project-tabs-bar">
      <div className="project-tabs-list">
        {tabs.map((tab, index) => {
          const isActive = index === activeTabIndex;
          return (
            <button
              key={tab.session_id}
              className={`project-tab${isActive ? ' active' : ''}`}
              onClick={() => switchToTab(index)}
              title={tab.file_name}
            >
              <span className="project-tab-label">{tab.file_name}</span>
              {tabs.length > 1 && (
                <span
                  className="project-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(index);
                  }}
                  title="Cerrar pestana"
                >
                  <X size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        className="project-tab-new"
        onClick={handleNewTab}
        disabled={isLoading}
        title="Nueva pestana"
      >
        <Plus size={14} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
    </div>
  );
};
