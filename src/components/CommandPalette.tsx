import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDocStore } from '../store/useDocStore';
import { needsReview } from '../lib/portadaAuthors';
import { Search, ArrowRight, FileDown, FileText, FileType, FileCheck } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ElementType | null;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC = () => {
  const { doc, wizardStep, setWizardStep, exportDocx, exportPdf, setDownloadModalOpen } = useDocStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingForPhase = (phaseId: number) => {
    if (!doc) return 0;
    if (phaseId === 2) return doc.elements.filter((e) => e.type === 'heading' && needsReview(e as any)).length;
    if (phaseId === 3) {
      const figures = doc.elements.filter((e) => e.type === 'image' && needsReview(e as any)).length;
      const tables = doc.elements.filter((e) => e.type === 'table' && needsReview(e as any)).length;
      return figures + tables;
    }
    return 0;
  };

  const commands: Command[] = useMemo(() => [
    { id: 'next-pending', label: 'Siguiente fase con pendientes', shortcut: 'Ctrl+Enter', icon: ArrowRight, action: () => {
      const step = wizardStep;
      const nextWithPending = [1, 2, 3, 4, 5].find(s => s > step && pendingForPhase(s) > 0);
      if (nextWithPending) setWizardStep(nextWithPending);
      else if (step < 5) setWizardStep(step + 1);
      useDocStore.setState({ commandPaletteOpen: false });
    }, keywords: ['siguiente', 'next', 'pendiente', 'pending'] },

    { id: 'goto-portada', label: 'Ir a Portada', shortcut: 'Ctrl+1', icon: null, action: () => { setWizardStep(1); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['portada', 'cover', 'metadatos'] },
    { id: 'goto-estructura', label: 'Ir a Estructura (Títulos)', shortcut: 'Ctrl+2', icon: null, action: () => { setWizardStep(2); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['estructura', 'titulos', 'headings', 'h1', 'h2'] },
    { id: 'goto-figuras', label: 'Ir a Figuras y Tablas', shortcut: 'Ctrl+3', icon: null, action: () => { setWizardStep(3); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['figuras', 'tablas', 'imagenes', 'figures', 'tables'] },
    { id: 'goto-cuerpo', label: 'Ir a Cuerpo y Formato', shortcut: 'Ctrl+4', icon: null, action: () => { setWizardStep(4); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['cuerpo', 'formato', 'sangria', 'parrafo'] },
    { id: 'goto-referencias', label: 'Ir a Referencias y Validación', shortcut: 'Ctrl+5', icon: null, action: () => { setWizardStep(5); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['referencias', 'bibliografia', 'apa', 'validacion', 'citas'] },

    { id: 'download-docx', label: 'Descargar DOCX', shortcut: 'Ctrl+S', icon: FileDown, action: () => { exportDocx(false); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['descargar', 'export', 'docx', 'word'] },
    { id: 'download-pdf', label: 'Descargar PDF', shortcut: 'Ctrl+Shift+S', icon: FileText, action: () => { exportPdf(); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['descargar', 'export', 'pdf'] },
    { id: 'download-open-modal', label: 'Abrir ventana de descarga', shortcut: '', icon: FileCheck, action: () => { setDownloadModalOpen(true); useDocStore.setState({ commandPaletteOpen: false }); }, keywords: ['descargar', 'download', 'modal'] },
  ], [doc, wizardStep, setWizardStep, exportDocx, exportPdf, setDownloadModalOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true;
      if (c.keywords?.some((k) => k.includes(q))) return true;
      return false;
    });
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useDocStore.setState({ commandPaletteOpen: false });
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      onClick={() => useDocStore.setState({ commandPaletteOpen: false })}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', justifyContent: 'center', paddingTop: '15vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, maxHeight: 420, overflow: 'hidden',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <Search size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Escribí un comando o buscá..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Sin resultados
            </div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon as React.ComponentType<{ size?: number; style?: React.CSSProperties }> | null;
            const isSelected = i === selectedIndex;
            return (
              <div
                key={cmd.id}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px', cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--color-accent-soft)' : 'transparent',
                  color: 'var(--color-text-primary)',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {Icon && <Icon size={16} style={{ color: 'var(--color-text-secondary)' }} />}
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span style={{
                    fontSize: '11px', color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-surface-alt)',
                    padding: '1px 6px', borderRadius: '4px',
                  }}>
                    {cmd.shortcut}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
