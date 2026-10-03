import React from 'react';
import { Image, Table2, Pi, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ContextoFigura } from '../../lib/figuras';

interface Props {
  contextos: ContextoFigura[];
  indiceActivo: number | null;
  onSelectIndice: (idx: number) => void;
}

export const GaleriaActivosColumna: React.FC<Props> = ({
  contextos,
  indiceActivo,
  onSelectIndice,
}) => {
  return (
    <aside
      aria-label="Galería de activos"
      style={{
        width: '320px',
        backgroundColor: 'var(--surface-base, #ffffff)',
        borderRight: '1px solid var(--border-subtle, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          Activos en documento ({contextos.length})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {contextos.map((ctx) => {
          const isSelected = indiceActivo === ctx.indice;
          const isConforme = ctx.tieneLeyenda && !!ctx.leyenda.trim();

          return (
            <div
              key={ctx.id || ctx.indice}
              role="button"
              tabIndex={0}
              onClick={() => onSelectIndice(ctx.indice)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectIndice(ctx.indice);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                borderLeft: isSelected ? '3px solid var(--accent-primary, #0284c7)' : '3px solid transparent',
                backgroundColor: isSelected ? 'var(--accent-subtle, #f0f9ff)' : 'transparent',
                transition: 'background-color 0.15s ease, border-left-color 0.15s ease',
              }}
            >
              {/* Miniatura 52x42px */}
              <div
                data-testid="asset-thumbnail"
                style={{
                  width: '52px',
                  height: '42px',
                  flexShrink: 0,
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  backgroundColor: 'var(--surface-raised, #f8fafc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {ctx.tipo === 'image' && ctx.url ? (
                  <img
                    src={ctx.url}
                    alt={ctx.rotulo}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : ctx.tipo === 'table' ? (
                  <Table2 size={20} color="var(--text-muted, #64748b)" />
                ) : ctx.tipo === 'equation' ? (
                  <Pi size={20} color="var(--text-muted, #64748b)" />
                ) : (
                  <Image size={20} color="var(--text-muted, #64748b)" />
                )}
              </div>

              {/* Metadatos y Rótulo */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent-primary, #0284c7)' : 'var(--text-main, #1e293b)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ctx.rotulo}
                  </span>

                  {/* Badge de Conformidad APA 7 */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      fontWeight: 500,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontVariantNumeric: 'tabular-nums',
                      backgroundColor: isConforme ? '#ecfdf5' : '#fffbeb',
                      color: isConforme ? '#059669' : '#d97706',
                      border: `1px solid ${isConforme ? '#a7f3d0' : '#fde68a'}`,
                      flexShrink: 0,
                    }}
                  >
                    {isConforme ? (
                      <>
                        <CheckCircle2 size={11} />
                        <span>Conforme</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={11} />
                        <span>Sin leyenda</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Leyenda o placeholder */}
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted, #64748b)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: '1.3',
                  }}
                >
                  {ctx.leyenda && ctx.leyenda.trim() ? ctx.leyenda : 'Sin leyenda definida'}
                </span>

                {/* Sección o capítulo contenedor */}
                {ctx.seccion && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-subtle, #94a3b8)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ctx.seccion}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
