import React, { useState } from 'react';
import type { ElementModel } from '../../types';
import {
  Sliders,
  Type,
  Palette,
  ShieldCheck,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export type InspectorTabKey = 'formato' | 'texto' | 'estilo' | 'calidad';

export interface InspectorActivoTabsProps {
  elem: ElementModel;
  totalFiguras: number;
  onUpdateImage: (id: string, patch: Partial<NonNullable<ElementModel['image_info']>>) => void;
  onApplyToAll: () => void;
}

interface StylePreset {
  value: string;
  label: string;
  desc: string;
  badge?: string;
  renderThumbnail: () => React.ReactNode;
}

const STYLE_PRESETS: StylePreset[] = [
  {
    value: 'standard',
    label: 'APA Estándar',
    desc: 'Figura centrada con etiqueta y título en líneas separadas arriba.',
    badge: 'Oficial',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="8" y="5" width="16" height="2" rx="1" fill="var(--accent-primary)" />
        <rect x="8" y="9" width="28" height="2" rx="1" fill="var(--color-text-secondary)" />
        <rect x="12" y="14" width="24" height="14" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: 'scientific',
    label: 'Científico',
    desc: 'Borde perimetral técnico con Figura N en negrita y nota al pie estructurada.',
    badge: 'Técnico',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="6" y="5" width="36" height="24" rx="2" fill="transparent" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="10" y="8" width="28" height="14" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="10" y="24" width="20" height="2" rx="1" fill="var(--color-text-muted)" />
      </svg>
    ),
  },
  {
    value: 'full_width',
    label: 'Ancho Completo',
    desc: 'Ocupa el 100% del margen útil de la página. Ideal para mapas o planos.',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="4" y="6" width="40" height="20" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="4" y="28" width="26" height="2" rx="1" fill="var(--color-text-muted)" />
      </svg>
    ),
  },
  {
    value: 'sidebar',
    label: 'Compacto / Flotante',
    desc: 'Cuadro lateral estrecho con ajuste de texto continuo.',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="26" y="6" width="16" height="22" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="6" y="8" width="16" height="2" rx="1" fill="var(--color-text-muted)" />
        <rect x="6" y="13" width="16" height="2" rx="1" fill="var(--color-text-muted)" />
        <rect x="6" y="18" width="16" height="2" rx="1" fill="var(--color-text-muted)" />
      </svg>
    ),
  },
  {
    value: 'multipanel',
    label: 'Doble Horizontal (a, b)',
    desc: 'Dos subfiguras en paralelo rotuladas como (a) y (b) lado a lado.',
    badge: 'Doble',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="6" y="7" width="16" height="15" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="26" y="7" width="16" height="15" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="12" y="25" width="4" height="2" rx="1" fill="var(--accent-primary)" />
        <rect x="32" y="25" width="4" height="2" rx="1" fill="var(--accent-primary)" />
      </svg>
    ),
  },
  {
    value: 'grid_2x2',
    label: 'Cuadrícula 2×2 (a, b, c, d)',
    desc: 'Malla simétrica de 4 subfiguras para estudios comparativos complejos.',
    badge: 'Malla',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="7" y="5" width="15" height="10" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="26" y="5" width="15" height="10" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="7" y="18" width="15" height="10" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="26" y="18" width="15" height="10" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    value: 'vertical_stack',
    label: 'Vertical Apilado (a, b)',
    desc: 'Secuencia longitudinal una sobre otra con rótulo independiente.',
    badge: 'Serie',
    renderThumbnail: () => (
      <svg width="44" height="28" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="2" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="1" />
        <rect x="8" y="5" width="32" height="10" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
        <rect x="8" y="18" width="32" height="10" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="1" />
      </svg>
    ),
  },
];

export const InspectorActivoTabs: React.FC<InspectorActivoTabsProps> = ({
  elem,
  totalFiguras,
  onUpdateImage,
  onApplyToAll,
}) => {
  const [tabActiva, setTabActiva] = useState<InspectorTabKey>('formato');
  const [alcance, setAlcance] = useState<'esta' | 'todas'>('esta');

  const imgInfo = elem.image_info || {};
  const widthCm = typeof imgInfo.width_cm === 'number' ? imgInfo.width_cm : 14.5;
  const heightCm = typeof imgInfo.height_cm === 'number' ? imgInfo.height_cm : 9.0;
  const alignment = imgInfo.alignment || 'center';
  const caption = imgInfo.caption || '';
  const note = imgInfo.note || '';
  const altText = imgInfo.alt_text || '';
  const currentStyle = imgInfo.design_style || 'standard';

  // Diagnósticos APA 7
  const checks = [
    {
      id: 'caption',
      passed: Boolean(caption && caption.trim().length > 0),
      label: 'Título breve y descriptivo en cursiva',
      failMessage: 'Falta título o leyenda en la figura.',
    },
    {
      id: 'width',
      passed: widthCm <= 16.5,
      label: 'Ancho dentro del margen útil (≤ 16.5 cm)',
      failMessage: `Excede ancho de caja útil (${widthCm.toFixed(1)} cm > 16.5 cm).`,
    },
    {
      id: 'alt',
      passed: Boolean(altText && altText.trim().length > 0),
      label: 'Texto alternativo para lectores de pantalla',
      failMessage: 'Sin texto alternativo accesible.',
    },
  ];

  const handleUpdate = (patch: Partial<NonNullable<ElementModel['image_info']>>) => {
    onUpdateImage(elem.id, patch);
  };

  const handleAutocompletar = () => {
    handleUpdate({
      width_cm: Math.min(widthCm, 15.0),
      alignment: 'center',
      design_style: 'standard',
      caption: caption || 'Figura sin título especificado',
      note: note || 'Nota. Adaptado para cumplimiento de formato general APA 7ma edición.',
      alt_text: altText || 'Gráfico informativo del documento.',
    });
  };

  const tabs: { key: InspectorTabKey; label: string; icon: React.FC<{ size: number }> }[] = [
    { key: 'formato', label: 'Formato', icon: Sliders },
    { key: 'texto', label: 'Texto', icon: Type },
    { key: 'estilo', label: 'Estilo', icon: Palette },
    { key: 'calidad', label: 'Calidad', icon: ShieldCheck },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--color-bg-surface, #ffffff)',
        borderLeft: '1px solid var(--border-subtle, #e2e8f0)',
        fontSize: '12px',
        color: 'var(--color-text-primary, #0f172a)',
      }}
    >
      {/* Barra de Pestañas Planas */}
      <div
        role="tablist"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActiva = tabActiva === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActiva}
              onClick={() => setTabActiva(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                padding: '10px 4px',
                border: 'none',
                borderBottom: isActiva
                  ? '2px solid var(--accent-primary, #0284c7)'
                  : '2px solid transparent',
                backgroundColor: isActiva ? 'var(--color-bg-surface, #ffffff)' : 'transparent',
                color: isActiva
                  ? 'var(--accent-primary, #0284c7)'
                  : 'var(--color-text-secondary, #64748b)',
                fontWeight: isActiva ? 600 : 500,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
              }}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenedor de Contenido */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* PESTAÑA FORMATO */}
        {tabActiva === 'formato' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Dimensiones numéricas y slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary, #64748b)' }}>
                  Dimensiones
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-primary, #0284c7)' }}>
                  {widthCm.toFixed(1)} × {heightCm.toFixed(1)} cm
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label
                    htmlFor="field-ancho-cm"
                    style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary, #64748b)', marginBottom: '3px' }}
                  >
                    Ancho (cm)
                  </label>
                  <input
                    id="field-ancho-cm"
                    type="number"
                    step="0.1"
                    min="3"
                    max="20"
                    value={widthCm}
                    onChange={(e) => handleUpdate({ width_cm: parseFloat(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '11px',
                      border: '1px solid var(--border-subtle, #cbd5e1)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                      color: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="field-alto-cm"
                    style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-secondary, #64748b)', marginBottom: '3px' }}
                  >
                    Alto (cm)
                  </label>
                  <input
                    id="field-alto-cm"
                    type="number"
                    step="0.1"
                    min="2"
                    max="25"
                    value={heightCm}
                    onChange={(e) => handleUpdate({ height_cm: parseFloat(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '11px',
                      border: '1px solid var(--border-subtle, #cbd5e1)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                      color: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '4px' }}>
                <input
                  aria-label="Slider de ancho"
                  type="range"
                  min="5"
                  max="17"
                  step="0.5"
                  value={widthCm}
                  onChange={(e) => handleUpdate({ width_cm: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent-primary, #0284c7)' }}
                />
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #e2e8f0)' }} />

            {/* Alineación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary, #64748b)' }}>
                Alineación
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button
                  type="button"
                  aria-label="Alinear Izquierda"
                  onClick={() => handleUpdate({ alignment: 'left' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    border: alignment === 'left' ? '1px solid var(--accent-primary, #0284c7)' : '1px solid var(--border-subtle, #cbd5e1)',
                    backgroundColor: alignment === 'left' ? 'var(--color-accent-soft, #f0f9ff)' : 'var(--color-bg-surface-alt, #f8fafc)',
                    color: alignment === 'left' ? 'var(--accent-primary, #0284c7)' : 'inherit',
                    borderRadius: '4px',
                  }}
                >
                  <AlignLeft size={13} />
                  <span>Izq</span>
                </button>
                <button
                  type="button"
                  aria-label="Alinear Centro"
                  onClick={() => handleUpdate({ alignment: 'center' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    border: alignment === 'center' ? '1px solid var(--accent-primary, #0284c7)' : '1px solid var(--border-subtle, #cbd5e1)',
                    backgroundColor: alignment === 'center' ? 'var(--color-accent-soft, #f0f9ff)' : 'var(--color-bg-surface-alt, #f8fafc)',
                    color: alignment === 'center' ? 'var(--accent-primary, #0284c7)' : 'inherit',
                    borderRadius: '4px',
                  }}
                >
                  <AlignCenter size={13} />
                  <span>Centro</span>
                </button>
                <button
                  type="button"
                  aria-label="Alinear Derecha"
                  onClick={() => handleUpdate({ alignment: 'right' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    border: alignment === 'right' ? '1px solid var(--accent-primary, #0284c7)' : '1px solid var(--border-subtle, #cbd5e1)',
                    backgroundColor: alignment === 'right' ? 'var(--color-accent-soft, #f0f9ff)' : 'var(--color-bg-surface-alt, #f8fafc)',
                    color: alignment === 'right' ? 'var(--accent-primary, #0284c7)' : 'inherit',
                    borderRadius: '4px',
                  }}
                >
                  <AlignRight size={13} />
                  <span>Der</span>
                </button>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #e2e8f0)' }} />

            {/* Alcance de aplicación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                htmlFor="select-alcance"
                style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary, #64748b)' }}
              >
                Alcance
              </label>
              <select
                id="select-alcance"
                aria-label="Alcance"
                value={alcance}
                onChange={(e) => setAlcance(e.target.value as 'esta' | 'todas')}
                style={{
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                  color: 'inherit',
                }}
              >
                <option value="esta">Solo esta figura</option>
                <option value="todas">Todas las figuras ({totalFiguras})</option>
              </select>

              {alcance === 'todas' && (
                <button
                  type="button"
                  onClick={onApplyToAll}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '7px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'var(--accent-primary, #0284c7)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Sliders size={13} />
                  <span>Aplicar a todas las figuras</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA TEXTO */}
        {tabActiva === 'texto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="field-caption"
                style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '4px' }}
              >
                Título / Leyenda
              </label>
              <input
                id="field-caption"
                type="text"
                value={caption}
                onChange={(e) => handleUpdate({ caption: e.target.value })}
                placeholder="Ej. Distribución de respuestas según cohorte..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="field-note"
                style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '4px' }}
              >
                Nota al pie
              </label>
              <textarea
                id="field-note"
                rows={3}
                value={note}
                onChange={(e) => handleUpdate({ note: e.target.value })}
                placeholder="Nota. Datos obtenidos mediante muestreo aleatorio estratificado..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="field-alt-text"
                style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary, #64748b)', marginBottom: '4px' }}
              >
                Texto alternativo
              </label>
              <input
                id="field-alt-text"
                type="text"
                value={altText}
                onChange={(e) => handleUpdate({ alt_text: e.target.value })}
                placeholder="Descripción para lectores de pantalla..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                  color: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* PESTAÑA ESTILO */}
        {tabActiva === 'estilo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary, #64748b)' }}>
              Presets APA 7 ({STYLE_PRESETS.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {STYLE_PRESETS.map((preset) => {
                const isSelected = currentStyle === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleUpdate({ design_style: preset.value })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      textAlign: 'left',
                      border: isSelected ? '1px solid var(--accent-primary, #0284c7)' : '1px solid var(--border-subtle, #e2e8f0)',
                      backgroundColor: isSelected ? 'var(--color-accent-soft, #f0f9ff)' : 'var(--color-bg-surface-alt, #f8fafc)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    {preset.renderThumbnail()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--color-text-primary, #0f172a)' }}>
                          {preset.label}
                        </span>
                        {preset.badge && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: isSelected ? 'var(--accent-primary, #0284c7)' : 'var(--color-bg-surface, #e2e8f0)',
                              color: isSelected ? '#ffffff' : 'var(--color-text-secondary, #475569)',
                            }}
                          >
                            {preset.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--color-text-secondary, #64748b)', lineHeight: '1.3' }}>
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA CALIDAD */}
        {tabActiva === 'calidad' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary, #64748b)' }}>
                Diagnóstico APA 7
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: checks.every((c) => c.passed) ? '#dcfce7' : '#fef3c7',
                  color: checks.every((c) => c.passed) ? '#166534' : '#92400e',
                }}
              >
                {checks.filter((c) => c.passed).length}/{checks.length} Criterios
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {checks.map((chk) => (
                <div
                  key={chk.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    backgroundColor: 'var(--color-bg-surface-alt, #f8fafc)',
                  }}
                >
                  {chk.passed ? (
                    <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 500 }}>
                      {chk.label}
                    </p>
                    {!chk.passed && (
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#dc2626' }}>
                        {chk.failMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAutocompletar}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'var(--accent-primary, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              <Sparkles size={13} />
              <span>Autocompletar recomendación APA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default InspectorActivoTabs;
