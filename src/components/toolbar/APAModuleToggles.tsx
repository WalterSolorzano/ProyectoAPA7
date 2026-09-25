import React, { useState, useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';

/* ── Iconos SVG nativos a mano (sin dependencias, cero emojis) ── */
const SvgParagraph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 4v16" />
    <path d="M17 4v16" />
    <path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />
  </svg>
);

const SvgHeading = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 12h12" />
    <path d="M6 4v16" />
    <path d="M18 4v16" />
  </svg>
);

const SvgTable = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
    <path d="M3 10h18" />
    <path d="M10 3v18" />
  </svg>
);

const SvgImage = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const SvgReference = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const SvgCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SvgChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const MODULE_DEFINITIONS = [
  {
    id: 'texto',
    label: 'Párrafos & Sangrías',
    desc: 'Normaliza tipografía, interlineado doble y sangría 1.27 cm',
    icon: SvgParagraph,
  },
  {
    id: 'titulos',
    label: 'Jerarquía de Títulos',
    desc: 'Niveles 1 a 5 de APA 7 (negrita, centrado y formato limpio)',
    icon: SvgHeading,
  },
  {
    id: 'tablas',
    label: 'Tablas APA 7',
    desc: '3 bordes horizontales, cabeceras en negrita y leyendas normalizadas',
    icon: SvgTable,
  },
  {
    id: 'imagenes',
    label: 'Figuras & Ilustraciones',
    desc: 'Centrado, Figura N en negrita, título cursiva y notas',
    icon: SvgImage,
  },
  {
    id: 'bibliografia',
    label: 'Referencias & Fuentes',
    desc: 'Sangría francesa 1.27 cm, orden alfabético y enlaces activos',
    icon: SvgReference,
  },
] as const;

export const APAModuleToggles: React.FC = () => {
  const sessionScopes = useDocStore((s) => s.sessionScopes);
  const setSessionScopes = useDocStore((s) => s.setSessionScopes);
  const showToast = useDocStore((s) => s.showToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mapear compatibilidad: si sessionScopes está vacío ([]), significa que todos están activos
  const isAllActive = sessionScopes.length === 0;

  const isModuleActive = (id: string) => {
    if (isAllActive) return true;
    if (id === 'tablas' || id === 'imagenes') {
      return sessionScopes.includes('tablas_imagenes') || sessionScopes.includes(id);
    }
    return sessionScopes.includes(id);
  };

  const toggleModule = (id: string) => {
    let currentActive: string[];
    if (isAllActive) {
      // Si todos estaban activos implícitamente, listar todos y quitar el pulsado
      currentActive = ['texto', 'titulos', 'tablas', 'imagenes', 'bibliografia'];
    } else {
      currentActive = [...sessionScopes];
      // Si contenía tablas_imagenes convertirlo a los 2 desglosados
      if (currentActive.includes('tablas_imagenes')) {
        currentActive = currentActive.filter((s) => s !== 'tablas_imagenes');
        if (!currentActive.includes('tablas')) currentActive.push('tablas');
        if (!currentActive.includes('imagenes')) currentActive.push('imagenes');
      }
    }

    let next: string[];
    if (currentActive.includes(id)) {
      next = currentActive.filter((s) => s !== id);
    } else {
      next = [...currentActive, id];
    }

    // Si marcó todos, colapsar a [] para máxima compatibilidad con el motor
    const allIds = ['texto', 'titulos', 'tablas', 'imagenes', 'bibliografia'];
    const isFullNow = allIds.every((k) => next.includes(k));
    const finalScopes = isFullNow ? [] : next;

    setSessionScopes(finalScopes);
    showToast(
      next.includes(id) ? `Módulo "${id}" activado` : `Módulo "${id}" omitido`,
      'info'
    );
  };

  // Cerrar al click afuera
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      window.addEventListener('mousedown', handleOutside);
    }
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const activeCount = isAllActive
    ? MODULE_DEFINITIONS.length
    : MODULE_DEFINITIONS.filter((m) => isModuleActive(m.id)).length;

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        title="Configurar qué módulos APA 7 estandarizar en el documento"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: menuOpen ? 'var(--color-accent-soft)' : 'var(--surface-subtle)',
          color: 'var(--text-main)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-primary)' }}>
          <SvgParagraph />
        </span>
        <span>Estandarización APA ({activeCount}/5)</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          <SvgChevronDown />
        </span>
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '320px',
            backgroundColor: 'var(--sidebar-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 1000,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
              Módulos Activos
            </span>
            <button
              type="button"
              onClick={() => {
                setSessionScopes([]);
                showToast('Todos los módulos APA 7 activos', 'success');
              }}
              style={{
                fontSize: '11px',
                color: 'var(--accent-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                padding: 0,
              }}
            >
              Marcar todos
            </button>
          </div>

          {MODULE_DEFINITIONS.map((mod) => {
            const active = isModuleActive(mod.id);
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  backgroundColor: active ? 'var(--color-accent-soft)' : 'transparent',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  {active && <SvgCheck />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                      <Icon />
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: active ? 'var(--text-main)' : 'var(--text-secondary)',
                        textDecoration: active ? 'none' : 'line-through',
                      }}
                    >
                      {mod.label}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {mod.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default APAModuleToggles;
