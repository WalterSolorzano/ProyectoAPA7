/* WordAPA7 — ImageEditPanel: panel modular de edición de imágenes
   Organizado en 4 secciones funcionales: Formato, Texto, Estilo y Revisión.
   Cero emojis — tokens de diseño del sistema. */

import React, { useState, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { SubfigureItem } from '../../types';
import { suggestCaption } from '../../api/backend';
import {
  UploadCloud, Loader2, Image as ImageIcon, RefreshCw, Plus, Trash2,
  CheckCircle2, AlertCircle, Sparkles, Sliders, Type, Palette, ShieldCheck,
} from 'lucide-react';

type TabKey = 'formato' | 'texto' | 'estilo' | 'revision';

interface DesignStyleOption {
  value: string;
  label: string;
  desc: string;
  badge?: string;
  renderThumbnail: () => React.ReactNode;
}

const DESIGN_STYLES: DesignStyleOption[] = [
  {
    value: 'standard',
    label: 'APA Estándar',
    desc: 'Figura centrada con etiqueta y título en líneas separadas arriba.',
    badge: 'Oficial',
    renderThumbnail: () => (
      <svg width="48" height="34" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="3" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" />
        <rect x="8" y="5" width="16" height="2" rx="1" fill="var(--accent-primary)" />
        <rect x="8" y="9" width="28" height="2" rx="1" fill="var(--text-secondary)" />
        <rect x="12" y="14" width="24" height="14" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
      </svg>
    ),
  },
  {
    value: 'scientific',
    label: 'Científico',
    desc: 'Borde perimetral técnico con Figura N en negrita y nota al pie estructurada.',
    badge: 'Técnico',
    renderThumbnail: () => (
      <svg width="48" height="34" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="3" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" />
        <rect x="6" y="5" width="36" height="24" rx="2" fill="transparent" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" strokeDasharray="2 2" />
        <rect x="10" y="8" width="28" height="14" rx="1" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
        <rect x="10" y="24" width="20" height="2" rx="1" fill="var(--text-muted)" />
      </svg>
    ),
  },
  {
    value: 'full_width',
    label: 'Ancho Completo',
    desc: 'Ocupa el 100% del margen útil de la página. Ideal para mapas o planos.',
    renderThumbnail: () => (
      <svg width="48" height="34" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="3" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" />
        <rect x="4" y="6" width="40" height="20" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
        <rect x="4" y="28" width="26" height="2" rx="1" fill="var(--text-muted)" />
      </svg>
    ),
  },
  {
    value: 'sidebar',
    label: 'Compacto / Flotante',
    desc: 'Cuadro lateral estrecho con ajuste de texto continuo.',
    renderThumbnail: () => (
      <svg width="48" height="34" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="3" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" />
        <rect x="26" y="6" width="16" height="22" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
        <rect x="6" y="8" width="16" height="2" rx="1" fill="var(--text-muted)" />
        <rect x="6" y="13" width="16" height="2" rx="1" fill="var(--text-muted)" />
        <rect x="6" y="18" width="16" height="2" rx="1" fill="var(--text-muted)" />
        <rect x="6" y="23" width="12" height="2" rx="1" fill="var(--text-muted)" />
      </svg>
    ),
  },
  {
    value: 'multipanel',
    label: 'Multipanel APA',
    desc: 'Conjunto de subfiguras rotuladas como (a), (b), (c) bajo una misma figura.',
    badge: 'Múltiple',
    renderThumbnail: () => (
      <svg width="48" height="34" viewBox="0 0 48 34" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="44" height="30" rx="3" fill="var(--color-bg-surface-alt)" stroke="var(--border-subtle)" strokeWidth="var(--icon-stroke)" />
        <rect x="6" y="7" width="16" height="15" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
        <rect x="26" y="7" width="16" height="15" rx="2" fill="var(--color-accent-soft)" stroke="var(--accent-primary)" strokeWidth="var(--icon-stroke)" />
        <rect x="12" y="25" width="4" height="2" rx="1" fill="var(--accent-primary)" />
        <rect x="32" y="25" width="4" height="2" rx="1" fill="var(--accent-primary)" />
      </svg>
    ),
  },
];

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{
    fontSize: '10px', fontWeight: 700, display: 'block',
    marginBottom: '4px', color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  }}>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '11px',
  backgroundColor: 'var(--color-bg-surface-alt)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

export const ImageEditPanel: React.FC<{ elem: any }> = ({ elem }) => {
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const showToast = useDocStore((s) => s.showToast);
  const doc = useDocStore((s) => s.doc);

  const [activeTab, setActiveTab] = useState<TabKey>('formato');
  const [constrain, setConstrain] = useState(elem.image_info?.constrain_proportions !== false);
  const [replacing, setReplacing] = useState(false);
  const [suggestingIA, setSuggestingIA] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const img = elem.image_info || {};
  const originalWidth = img.width_cm || 12;
  const originalHeight = img.height_cm || 8;
  const aspectRatio = originalWidth / (originalHeight || 1);
  const rotation = img.rotation || 0;
  const currentDesign = img.design_style || 'standard';

  const setProp = (p: string, v: any) => updateElementImage(elem.id, { [p]: v });

  // Debounce (280ms)
  const debounceTimerW = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerH = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 280;

  const setWidth = (w: number) => {
    if (debounceTimerW.current) clearTimeout(debounceTimerW.current);
    debounceTimerW.current = setTimeout(() => {
      if (constrain) updateElementImage(elem.id, { width_cm: w, height_cm: Math.round((w / aspectRatio) * 10) / 10 });
      else updateElementImage(elem.id, { width_cm: w });
    }, DEBOUNCE_MS);
  };

  const setHeight = (h: number) => {
    if (debounceTimerH.current) clearTimeout(debounceTimerH.current);
    debounceTimerH.current = setTimeout(() => {
      if (constrain) updateElementImage(elem.id, { height_cm: h, width_cm: Math.round((h * aspectRatio) * 10) / 10 });
      else updateElementImage(elem.id, { height_cm: h });
    }, DEBOUNCE_MS);
  };

  const restoreSize = () => {
    if (debounceTimerW.current) clearTimeout(debounceTimerW.current);
    if (debounceTimerH.current) clearTimeout(debounceTimerH.current);
    updateElementImage(elem.id, {
      width_cm: originalWidth, height_cm: originalHeight, width_inches: null, height_inches: null,
    });
    showToast('Tamaño original restaurado', 'success');
  };

  const replaceFile = async (file: File) => {
    if (!doc) return;
    setReplacing(true);
    try {
      await useDocStore.getState().replaceImage(elem.id, file);
      showToast('Imagen reemplazada', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al reemplazar la imagen', 'error');
    } finally {
      setReplacing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runSuggestCaption = async () => {
    if (!doc) return;
    setSuggestingIA(true);
    try {
      const idx = doc.elements.findIndex((e: any) => e.id === elem.id);
      const ctx: string[] = [];
      for (let i = Math.max(0, idx - 2); i < Math.min(doc.elements.length, idx + 3); i++) {
        const e: any = doc.elements[i];
        if (e.id === elem.id) continue;
        const t = (e.text || '').trim();
        if (t) ctx.push(t);
      }
      const suggestion = await suggestCaption(
        doc.session_id, elem.id, ctx.join('\n'), useDocStore.getState().apiKey,
      );
      if (suggestion) {
        updateElementImage(elem.id, { caption: suggestion });
        showToast('Leyenda sugerida por IA aplicada', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al generar sugerencia con IA', 'error');
    } finally {
      setSuggestingIA(false);
    }
  };

  const needsAttention = !img.caption || img.caption.trim().length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
      {/* Cabecera del Inspector de Figura */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
          flexShrink: 0,
        }}>
          <ImageIcon size={15} strokeWidth={1.75} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              Figura {img.figure_number || 1}
            </span>
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-full)',
              backgroundColor: needsAttention ? 'var(--color-warning-a12)' : 'var(--color-success-a14)',
              color: needsAttention ? 'var(--color-warning)' : 'var(--color-success)',
            }}>
              {needsAttention ? 'Sin leyenda' : 'APA 7'}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
            {img.width_cm || 12} × {img.height_cm || 8} cm · {img.alignment === 'center' ? 'Centrada' : img.alignment === 'left' ? 'Izquierda' : 'Derecha'}
          </div>
        </div>
      </div>

      {/* ── 4 PESTAÑAS PRINCIPALES: Formato | Texto | Estilo | Revisión ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '2px', backgroundColor: 'var(--color-bg-surface-alt)',
        padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
      }}>
        {[
          { key: 'formato' as TabKey, label: 'Formato', Icon: Sliders },
          { key: 'texto' as TabKey, label: 'Texto', Icon: Type },
          { key: 'estilo' as TabKey, label: 'Estilo', Icon: Palette },
          { key: 'revision' as TabKey, label: 'Revisión', Icon: ShieldCheck },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '3px', padding: '6px 2px', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: active ? 'var(--color-bg-surface)' : 'transparent',
                color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition-fast)',
                fontFamily: 'inherit',
              }}
            >
              <tab.Icon size={13} strokeWidth={1.75} />
              <span style={{ fontSize: '10px', fontWeight: active ? 700 : 500 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 1. FORMATO ────────────────────────────────────────── */}
      {activeTab === 'formato' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={sectionCardStyle}>
            <div>
              <FieldLabel>Alineación en la página</FieldLabel>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { value: 'left', label: 'Izquierda' },
                  { value: 'center', label: 'Centrada (APA)' },
                  { value: 'right', label: 'Derecha' },
                ].map((opt) => {
                  const active = (img.alignment || 'center') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProp('alignment', opt.value)}
                      style={{
                        flex: 1, padding: '6px 4px', fontSize: '10px', fontWeight: active ? 700 : 500,
                        cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
                        color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel>Flujo de texto</FieldLabel>
              <select
                style={inputStyle}
                value={img.wrap_style || 'inline'}
                onChange={(e) => setProp('wrap_style', e.target.value)}
              >
                <option value="inline">En línea con el texto (Recomendado APA 7)</option>
                <option value="square">Cuadrado (Texto alrededor)</option>
                <option value="top_and_bottom">Arriba y abajo (Sin texto a los lados)</option>
                <option value="tight">Estrecho</option>
              </select>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <FieldLabel>Dimensiones físicas</FieldLabel>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Ancho (cm)</span>
                <input
                  type="number"
                  step="0.5"
                  min={2}
                  max={25}
                  style={inputStyle}
                  value={img.width_cm || 12}
                  onChange={(e) => setWidth(parseFloat(e.target.value) || 12)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Alto (cm)</span>
                <input
                  type="number"
                  step="0.5"
                  min={2}
                  max={25}
                  style={inputStyle}
                  value={img.height_cm || 8}
                  onChange={(e) => setHeight(parseFloat(e.target.value) || 8)}
                />
              </div>
            </div>

            <div>
              <input
                type="range"
                min={3}
                max={20}
                step={0.5}
                value={img.width_cm || 12}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                <span>3 cm</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{img.width_cm || 12} cm</span>
                <span>20 cm (página)</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={constrain}
                  onChange={(e) => { setConstrain(e.target.checked); setProp('constrain_proportions', e.target.checked); }}
                />
                Mantener proporción
              </label>

              <button
                type="button"
                onClick={restoreSize}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', fontSize: '10px',
                  color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600,
                }}
              >
                <RefreshCw size={11} /> Resetear
              </button>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <FieldLabel>Rotación de imagen</FieldLabel>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0, 90, 180, 270].map((deg) => {
                const active = rotation === deg;
                return (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setProp('rotation', deg)}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: '10px', fontWeight: active ? 700 : 500,
                      cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
                      color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    {deg === 0 ? '0°' : `${deg}°`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TEXTO & LEYENDA APA 7 ──────────────────────────── */}
      {activeTab === 'texto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={sectionCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FieldLabel>Título de la figura (Leyenda)</FieldLabel>
              <button
                type="button"
                onClick={runSuggestCaption}
                disabled={suggestingIA}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                  padding: '2px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                }}
                title="Generar leyenda APA 7 con base en el texto cercano"
              >
                {suggestingIA ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
                <span>Sugerir con IA</span>
              </button>
            </div>

            <textarea
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={img.caption || ''}
              onChange={(e) => setProp('caption', e.target.value)}
              placeholder="Ej: Diagrama de flujo del balance de materia y energía"
            />

            <div>
              <FieldLabel>Posición de la leyenda</FieldLabel>
              <select
                style={inputStyle}
                value={img.caption_position || 'above'}
                onChange={(e) => setProp('caption_position', e.target.value)}
              >
                <option value="above">Sobre la imagen (Oficial APA 7)</option>
                <option value="below">Debajo de la imagen</option>
              </select>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <FieldLabel>Nota al pie de figura</FieldLabel>
            <textarea
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={img.note || ''}
              onChange={(e) => setProp('note', e.target.value)}
              placeholder="Ej: Nota. Adaptado de Guía Metodológica de Balance (p. 42), por..."
            />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              En APA 7, la nota explica abreviaturas, fuentes o permisos de reproducción.
            </span>
          </div>

          <div style={sectionCardStyle}>
            <FieldLabel>Texto alternativo (Accesibilidad)</FieldLabel>
            <textarea
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={img.alt_text || ''}
              onChange={(e) => setProp('alt_text', e.target.value)}
              placeholder="Descripción breve y precisa para lectores de pantalla"
            />
          </div>
        </div>
      )}

      {/* ── 3. ESTILO & PRESETS VISUALES ────────────────────────── */}
      {activeTab === 'estilo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Selecciona un preset con diseño editorial APA:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DESIGN_STYLES.map((style) => {
              const selected = currentDesign === style.value;
              return (
                <div
                  key={style.value}
                  onClick={() => {
                    if (style.value === 'multipanel' && (!img.subfigures || img.subfigures.length === 0)) {
                      const initialSubs: SubfigureItem[] = [
                        {
                          id: `sub_${Date.now()}_a`,
                          label: '(a)',
                          title: img.caption || 'Vista principal',
                          relative_url: img.relative_url || '',
                          file_path: img.file_path || '',
                          filename: img.filename || '',
                        },
                        {
                          id: `sub_${Date.now()}_b`,
                          label: '(b)',
                          title: 'Detalle ampliado',
                          relative_url: img.relative_url || '',
                          file_path: img.file_path || '',
                          filename: img.filename || '',
                        },
                      ];
                      updateElementImage(elem.id, { design_style: 'multipanel', subfigures: initialSubs });
                    } else {
                      setProp('design_style', style.value);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    backgroundColor: selected ? 'var(--color-accent-soft)' : 'var(--color-bg-surface)',
                    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer', transition: 'all var(--transition-fast)',
                  }}
                >
                  {style.renderThumbnail()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: selected ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                        {style.label}
                      </span>
                      {style.badge && (
                        <span style={{
                          fontSize: '8px', fontWeight: 800, padding: '1px 5px', borderRadius: 'var(--radius-full)',
                          backgroundColor: selected ? 'var(--accent-primary)' : 'var(--surface-subtle)',
                          color: selected ? 'var(--color-text-on-accent)' : 'var(--text-secondary)',
                        }}>
                          {style.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.35 }}>
                      {style.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subfiguras si está en modo Multipanel */}
          {currentDesign === 'multipanel' && (
            <div style={sectionCardStyle}>
              <FieldLabel>Subfiguras multipanel APA (a, b, c)</FieldLabel>
              {((img.subfigures as SubfigureItem[]) || []).map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  style={{
                    padding: '8px', backgroundColor: 'var(--color-bg-surface-alt)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      Panel {sub.label || `(${String.fromCharCode(97 + idx)})`}
                    </span>
                    {((img.subfigures?.length || 0) > 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSubs = img.subfigures!.filter((_: SubfigureItem, i: number) => i !== idx);
                          setProp('subfigures', newSubs);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    style={inputStyle}
                    value={sub.title || ''}
                    placeholder="Título del panel..."
                    onChange={(e) => {
                      const newSubs = [...(img.subfigures || [])];
                      newSubs[idx] = { ...newSubs[idx], title: e.target.value };
                      setProp('subfigures', newSubs);
                    }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const nextChar = String.fromCharCode(97 + (img.subfigures?.length || 0));
                  const newSubs: SubfigureItem[] = [
                    ...(img.subfigures || []),
                    {
                      id: `sub_${Date.now()}_${nextChar}`,
                      label: `(${nextChar})`,
                      title: `Panel ${nextChar.toUpperCase()}`,
                      relative_url: img.relative_url || '',
                      file_path: img.file_path || '',
                      filename: img.filename || '',
                    },
                  ];
                  setProp('subfigures', newSubs);
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '6px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  backgroundColor: 'transparent', border: '1px dashed var(--accent-primary)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)', fontFamily: 'inherit',
                }}
              >
                <Plus size={12} /> Añadir subfigura ({String.fromCharCode(97 + (img.subfigures?.length || 0))})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 4. REVISIÓN & ARCHIVO ───────────────────────────────── */}
      {activeTab === 'revision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={sectionCardStyle}>
            <FieldLabel>Estado de conformidad APA 7</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {needsAttention ? (
                <AlertCircle size={18} color="var(--color-warning)" style={{ flexShrink: 0 }} />
              ) : (
                <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0 }} />
              )}
              <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {needsAttention ? (
                  <span><strong>Falta leyenda o título:</strong> APA 7 exige que toda figura tenga una etiqueta y descripción breve.</span>
                ) : (
                  <span><strong>Cumple con la norma:</strong> La figura cuenta con leyenda formal configurada.</span>
                )}
              </div>
            </div>

            {needsAttention && (
              <button
                type="button"
                onClick={runSuggestCaption}
                disabled={suggestingIA}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  width: '100%', padding: '7px 10px', fontSize: '11px', fontWeight: 700,
                  backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
                  border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={12} /> Autocompletar con IA
              </button>
            )}
          </div>

          <div style={sectionCardStyle}>
            <FieldLabel>Reemplazar archivo de imagen</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await replaceFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={replacing || !doc}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', padding: '8px 12px', fontSize: '11px', fontWeight: 600,
                backgroundColor: 'transparent', border: '1px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', cursor: replacing ? 'wait' : 'pointer',
                color: 'var(--accent-primary)', fontFamily: 'inherit',
              }}
            >
              {replacing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UploadCloud size={14} />}
              {replacing ? 'Reemplazando archivo...' : 'Cargar nueva versión de imagen'}
            </button>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              Conserva el tamaño y las anotaciones APA configuradas previamente.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditPanel;
