import React from 'react';
import { Image, Table2, Pi, LucideIcon } from 'lucide-react';
import type { TipoFigura } from '../../lib/figuras';

interface Props {
  tipoActivo: TipoFigura;
  conteos: { image: number; table: number; equation: number };
  onTipoChange: (tipo: TipoFigura) => void;
}

export const RailTipoActivos: React.FC<Props> = ({ tipoActivo, conteos, onTipoChange }) => {
  const items: Array<{ id: TipoFigura; label: string; icon: LucideIcon; count: number }> = [
    { id: 'image', label: 'Figuras', icon: Image, count: conteos.image },
    { id: 'table', label: 'Tablas', icon: Table2, count: conteos.table },
    { id: 'equation', label: 'Ecuaciones', icon: Pi, count: conteos.equation },
  ];

  return (
    <aside
      aria-label="Selector de tipos de activos"
      style={{
        width: '52px',
        backgroundColor: '#0f172a',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const activo = tipoActivo === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTipoChange(item.id)}
            title={`${item.label} (${item.count})`}
            aria-label={`${item.label} (${item.count})`}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '6px',
              border: activo ? '1px solid #38bdf8' : '1px solid transparent',
              backgroundColor: activo ? '#1e293b' : 'transparent',
              color: activo ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Icon size={18} />
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                fontSize: '8px',
                fontWeight: 700,
                backgroundColor: activo ? '#0284c7' : '#334155',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '0 3px',
                lineHeight: '11px',
              }}
            >
              {item.count}
            </span>
          </button>
        );
      })}
    </aside>
  );
};
