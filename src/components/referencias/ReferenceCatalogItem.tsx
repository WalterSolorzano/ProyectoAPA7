import React from 'react';
import { Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ReferenciaModel } from '../../types';

export interface ReferenceCatalogItemProps {
  reference: ReferenciaModel;
  isSelected?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ReferenceCatalogItem: React.FC<ReferenceCatalogItemProps> = ({
  reference,
  isSelected,
  isActive,
  onSelect,
  onEdit,
  className = '',
  style,
}) => {
  const active = Boolean(isSelected ?? isActive);

  // Formatear autor principal y año
  const rawAuthor = reference.authors?.[0];
  const mainAuthor = rawAuthor ? rawAuthor.split(',')[0].trim() || 'Autor' : 'Autor';
  const yearText = reference.year && reference.year.trim() ? reference.year.trim() : 's.f.';

  const isVerified = Boolean(reference.verificada);
  const isOrphan = Boolean(reference.never_cited || reference.cited_count === 0);
  const mentionsCount = reference.cited_count ?? 0;
  const hasDoi = Boolean(reference.doi_or_url);

  return (
    <>
      <div
        tabIndex={0}
        aria-selected={active}
        onClick={() => onSelect?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.();
          }
        }}
        className={`card-source ${active ? 'active' : ''} ${className}`.trim()}
        style={{
          padding: '11px 13px',
          borderRadius: 'var(--radius-md, 8px)',
          border: active
            ? '1.5px solid var(--primary, var(--color-accent, #3b82f6))'
            : '1px solid var(--border-light, var(--color-border-subtle, #e2e8f0))',
          backgroundColor: active
            ? 'var(--primary-subtle, var(--color-accent-soft, #eff6ff))'
            : 'var(--paper-white, #ffffff)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          ...style,
        }}
      >
        {/* Botón flotante animado de edición en hover */}
        <button
          type="button"
          className="hover-edit-trigger"
          aria-label="Editar"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-medium, #cbd5e1)',
            boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
            color: 'var(--primary, var(--color-accent, #3b82f6))',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 9px',
            borderRadius: 'var(--radius-sm, 4px)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          <Pencil size={12} strokeWidth={2.5} />
          <span>Editar</span>
        </button>

        {/* Fila con Autor principal, Año y Badge de verificación */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            paddingRight: '20px',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--color-text-primary, #111827)',
            }}
          >
            {mainAuthor} ({yearText})
          </span>

          {isVerified ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--status-verified-bg, #ecfdf5)',
                color: 'var(--status-verified, #059669)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <CheckCircle2 size={11} strokeWidth={2.5} />
              <span>Verificada</span>
            </span>
          ) : isOrphan ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--status-warning-bg, #fffbeb)',
                color: 'var(--status-warning, #d97706)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <AlertTriangle size={11} strokeWidth={2.5} />
              <span>Sin citar</span>
            </span>
          ) : null}
        </div>

        {/* Título de la referencia */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary, #64748b)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {reference.title || 'Sin título'}
        </div>

        {/* Línea inferior: conteo de menciones y DOI */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '6px',
            fontSize: '11px',
          }}
        >
          <span
            style={{
              color: 'var(--text-light, var(--color-text-tertiary, #94a3b8))',
            }}
          >
            {mentionsCount} {mentionsCount === 1 ? 'mención' : 'menciones'}
          </span>

          {hasDoi && (
            <span
              style={{
                color: 'var(--primary, var(--color-accent, #3b82f6))',
                fontWeight: 700,
                marginLeft: 'auto',
                fontSize: '10px',
                letterSpacing: '0.04em',
              }}
            >
              DOI
            </span>
          )}
        </div>
      </div>

      <style>{`
        .card-source .hover-edit-trigger {
          opacity: 0;
          transform: translateX(12px) scale(0.9);
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }
        .card-source:hover .hover-edit-trigger,
        .card-source:focus-within .hover-edit-trigger {
          opacity: 1;
          transform: translateX(0) scale(1);
          pointer-events: auto;
        }
        .hover-edit-trigger:hover {
          background-color: var(--primary, var(--color-accent, #3b82f6)) !important;
          color: #ffffff !important;
          border-color: var(--primary, var(--color-accent, #3b82f6)) !important;
          transform: scale(1.06);
        }
      `}</style>
    </>
  );
};
