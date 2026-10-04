import React, { useState, useEffect, useCallback } from 'react';
import { X, BookOpen, Save } from 'lucide-react';
import type { ReferenciaModel } from '../../types';

export interface ReferenceEditModalProps {
  reference: ReferenciaModel | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<ReferenciaModel>) => void;
}

export function parseAuthors(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.includes(';')) {
    return trimmed.split(';').map((s) => s.trim()).filter(Boolean);
  }
  const parts = trimmed.split(/,\s*(?=[A-Za-zÀ-ÿ]+,\s*[A-Za-zÀ-ÿ]\.?)/);
  if (parts.length > 1) {
    return parts.map((s) => s.trim()).filter(Boolean);
  }
  if (trimmed.includes(',') && !/[A-Za-zÀ-ÿ]\.\s*$/.test(trimmed) && !/,\s*[A-Za-zÀ-ÿ]\./.test(trimmed)) {
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [trimmed];
}

export const ReferenceEditModal: React.FC<ReferenceEditModalProps> = ({
  reference,
  isOpen,
  onClose,
  onSave,
}) => {
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [doi, setDoi] = useState('');

  useEffect(() => {
    if (reference) {
      setAuthors(reference.authors ? reference.authors.join(', ') : '');
      setYear(reference.year || '');
      setTitle(reference.title || '');
      setSource(reference.source || '');
      setDoi(reference.doi_or_url || '');
    }
  }, [reference]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !reference) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      authors: parseAuthors(authors),
      year: year.trim(),
      title: title.trim(),
      source: source.trim(),
      doi_or_url: doi.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-edit-ref-title"
      data-testid="reference-edit-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--paper-white, #ffffff)',
          color: 'var(--color-text-primary, #0f172a)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1))',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} color="var(--primary, #4361ee)" />
            <h2
              id="modal-edit-ref-title"
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text-primary, #0f172a)',
              }}
            >
              Editar Ficha Bibliográfica
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #64748b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: 'var(--radius-sm, 4px)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="modalEditAuthors"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Autores (Apellido, Iniciales)
              </label>
              <input
                id="modalEditAuthors"
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Ej. Gómez, R., Morales, E."
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  backgroundColor: 'var(--surface-base, #ffffff)',
                  color: 'var(--color-text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="modalEditYear"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Año
              </label>
              <input
                id="modalEditYear"
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ej. 2023"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  backgroundColor: 'var(--surface-base, #ffffff)',
                  color: 'var(--color-text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="modalEditTitle"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--color-text-secondary, #64748b)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Título del Trabajo / Artículo
            </label>
            <input
              id="modalEditTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título completo de la obra"
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '13px',
                borderRadius: 'var(--radius-md, 6px)',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                backgroundColor: 'var(--surface-base, #ffffff)',
                color: 'var(--color-text-primary, #0f172a)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="modalEditSource"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Fuente / Revista / Editorial
              </label>
              <input
                id="modalEditSource"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Nombre de la revista o editorial"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  backgroundColor: 'var(--surface-base, #ffffff)',
                  color: 'var(--color-text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label
                htmlFor="modalEditDoi"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                DOI / Enlace Permanente
              </label>
              <input
                id="modalEditDoi"
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="https://doi.org/..."
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  backgroundColor: 'var(--surface-base, #ffffff)',
                  color: 'var(--color-text-primary, #0f172a)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-text-primary, #334155)',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                backgroundColor: 'var(--primary, #4361ee)',
                color: '#ffffff',
                border: 'none',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Save size={14} />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
