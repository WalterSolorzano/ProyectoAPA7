/* WordAPA7 — ImageEditPanel: panel modular de edición de imágenes
   con tarjetas colapsables en vertical (accordion), estilo apps de edición. */

import React, { useState, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  ChevronDown, Ruler, Paintbrush, AlignHorizontalJustifyCenter,
  RotateCw, Captions, StickyNote, Accessibility, UploadCloud,
  Loader2, Image as ImageIcon, RefreshCw,
} from 'lucide-react';

const DESIGN_STYLES = [
  { value: 'standard', label: 'Estandar', icon: '⊞', desc: 'Figura centrada, caption abajo' },
  { value: 'sidebar', label: 'Sidebar', icon: '◧', desc: 'Cuadro lateral derecho con borde' },
  { value: 'scientific', label: 'Cientifico', icon: '▣', desc: 'Borde negro fino, Figura X. arriba' },
  { value: 'corner', label: 'Esquina', icon: '◥', desc: 'Esquina superior derecha' },
  { value: 'full_width', label: 'Ancho completo', icon: '⬛', desc: 'Ancho completo de pagina' },
] as const;

// ── Tarjeta colapsable (accordion) ────────────────────────────────────────────

const Card: React.FC<{
  icon: React.ReactNode;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  accent?: string;
  children: React.ReactNode;
}> = ({ icon, title, badge, defaultOpen = false, accent, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: open ? `1px solid ${accent || 'var(--accent-primary)'}` : '1px solid var(--border-subtle)',
      overflow: 'hidden',
      backgroundColor: 'var(--color-bg-surface)',
      transition: 'border 0.15s',
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px', cursor: 'pointer', background: 'transparent',
          border: 'none', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
          backgroundColor: open ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
          color: open ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
            backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
          }}>
            {badge}
          </span>
        )}
        <ChevronDown size={14} color="var(--color-text-tertiary)" style={{
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
          flexShrink: 0,
        }} />
      </button>
      {open && (
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--color-bg-surface)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{
    fontSize: '10px', fontWeight: 600, display: 'block',
    marginBottom: '3px', color: 'var(--color-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.03em',
  }}>
    {children}
  </label>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', fontSize: '11px',
  backgroundColor: 'var(--color-bg-surface-alt)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)', fontFamily: 'inherit', outline: 'none',
};

// ── Panel principal ───────────────────────────────────────────────────────────

export const ImageEditPanel: React.FC<{ elem: any }> = ({ elem }) => {
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const showToast = useDocStore((s) => s.showToast);
  const doc = useDocStore((s) => s.doc);
  const [constrain, setConstrain] = useState(elem.image_info?.constrain_proportions !== false);
  const [replacing, setReplacing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const img = elem.image_info || {};
  const originalWidth = img.width_cm || 12;
  const originalHeight = img.height_cm || 8;
  const aspectRatio = originalWidth / originalHeight;
  const rotation = img.rotation || 0;
  const currentDesign = img.design_style || 'standard';

  const setProp = (p: string, v: any) => updateElementImage(elem.id, { [p]: v });

  const setWidth = (w: number) => {
    if (constrain) updateElementImage(elem.id, { width_cm: w, height_cm: Math.round((w / aspectRatio) * 10) / 10 });
    else updateElementImage(elem.id, { width_cm: w });
  };
  const setHeight = (h: number) => {
    if (constrain) updateElementImage(elem.id, { height_cm: h, width_cm: Math.round((h * aspectRatio) * 10) / 10 });
    else updateElementImage(elem.id, { height_cm: h });
  };
  const restoreSize = () => updateElementImage(elem.id, {
    width_cm: originalWidth, height_cm: originalHeight, width_inches: null, height_inches: null,
  });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
      {/* Cabecera del panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 2px 2px' }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
        }}>
          <ImageIcon size={14} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Editar imagen
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
            {img.width_cm || 12} × {img.height_cm || 8} cm
          </div>
        </div>
      </div>

      {/* 1. Tamaño */}
      <Card icon={<Ruler size={14} />} title="Tamaño y proporción" defaultOpen accent="var(--accent-primary)">
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Ancho (cm)</FieldLabel>
            <input type="number" step="0.5" min={1} max={30} style={inputStyle}
              value={img.width_cm || 12}
              onChange={(e) => setWidth(parseFloat(e.target.value) || 12)} />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Alto (cm)</FieldLabel>
            <input type="number" step="0.5" min={1} max={30} style={inputStyle}
              value={img.height_cm || 8}
              onChange={(e) => setHeight(parseFloat(e.target.value) || 8)} />
          </div>
        </div>
        <div>
          <input type="range" min={2} max={20} step={0.5}
            value={img.width_cm || 12}
            onChange={(e) => setWidth(parseFloat(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
            <span>2 cm</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{(img.width_cm || 12)} cm</span>
            <span>20 cm</span>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={constrain}
            onChange={(e) => { setConstrain(e.target.checked); setProp('constrain_proportions', e.target.checked); }} />
          Mantener proporción
        </label>
        <button type="button" onClick={restoreSize}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '5px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            backgroundColor: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)',
          }}>
          <RefreshCw size={12} /> Restaurar tamaño original
        </button>
      </Card>

      {/* 2. Estilo de diseño */}
      <Card icon={<Paintbrush size={14} />} title="Estilo de diseño" badge={currentDesign} defaultOpen accent="var(--accent-primary)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          {DESIGN_STYLES.map((ds) => {
            const active = currentDesign === ds.value;
            return (
              <button key={ds.value} type="button" onClick={() => setProp('design_style', ds.value)}
                title={ds.desc}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  padding: '7px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
                  color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                  fontSize: '10px', fontWeight: active ? 700 : 500, lineHeight: 1.2,
                }}>
                <span style={{ fontSize: '15px', lineHeight: 1 }}>{ds.icon}</span>
                <span>{ds.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Alineación y ajuste */}
      <Card icon={<AlignHorizontalJustifyCenter size={14} />} title="Alineación y ajuste" defaultOpen accent="var(--accent-primary)">
        <div>
          <FieldLabel>Alineación</FieldLabel>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { value: 'left', label: 'Izquierda' },
              { value: 'center', label: 'Centro' },
              { value: 'right', label: 'Derecha' },
            ].map((opt) => {
              const active = (img.alignment || 'center') === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => setProp('alignment', opt.value)}
                  style={{
                    flex: 1, padding: '5px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
                    color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldLabel>Ajuste de texto</FieldLabel>
          <select style={inputStyle} value={img.wrap_style || 'inline'}
            onChange={(e) => setProp('wrap_style', e.target.value)}>
            <option value="inline">En línea con el texto</option>
            <option value="square">Cuadrado</option>
            <option value="tight">Estrecho</option>
            <option value="top_and_bottom">Arriba y abajo</option>
          </select>
        </div>
        <div>
          <FieldLabel>Posición del título</FieldLabel>
          <select style={inputStyle} value={img.caption_position || 'above'}
            onChange={(e) => setProp('caption_position', e.target.value)}>
            <option value="above">Sobre la imagen (estándar APA)</option>
            <option value="below">Debajo de la imagen</option>
          </select>
        </div>
      </Card>

      {/* 4. Rotación */}
      <Card icon={<RotateCw size={14} />} title="Rotación" badge={rotation ? `${rotation}°` : undefined} defaultOpen accent="var(--accent-primary)">
        <div style={{ display: 'flex', gap: '4px' }}>
          {[0, 90, 180, 270].map((deg) => {
            const active = rotation === deg;
            return (
              <button key={deg} type="button" onClick={() => setProp('rotation', deg)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: active ? 'var(--color-accent-soft)' : 'var(--color-bg-surface-alt)',
                  color: active ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
                }}>
                {deg === 0 ? '0°' : `${deg}°`}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 5. Leyenda */}
      <Card icon={<Captions size={14} />} title="Leyenda / Caption" defaultOpen accent="var(--accent-primary)">
        <div>
          <FieldLabel>Título de la figura</FieldLabel>
          <input type="text" style={inputStyle} value={img.caption || ''}
            onChange={(e) => setProp('caption', e.target.value)}
            placeholder="Ej: Diagrama de flujo del proceso" />
        </div>
      </Card>

      {/* 6. Nota */}
      <Card icon={<StickyNote size={14} />} title="Nota al pie" accent="var(--accent-primary)">
        <div>
          <FieldLabel>Fuente / explicación</FieldLabel>
          <input type="text" style={inputStyle} value={img.note || ''}
            onChange={(e) => setProp('note', e.target.value)}
            placeholder="Ej: Adaptado de Fernández et al. (2024)" />
        </div>
      </Card>

      {/* 7. Accesibilidad */}
      <Card icon={<Accessibility size={14} />} title="Accesibilidad" accent="var(--accent-primary)">
        <div>
          <FieldLabel>Texto alternativo</FieldLabel>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={img.alt_text || ''}
            onChange={(e) => setProp('alt_text', e.target.value)}
            placeholder="Descripción breve de la figura" />
        </div>
      </Card>

      {/* 8. Reemplazar */}
      <Card icon={<UploadCloud size={14} />} title="Reemplazar imagen" accent="var(--accent-primary)">
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await replaceFile(file);
          }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={replacing || !doc}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '8px 12px', fontSize: '11px', fontWeight: 600,
            backgroundColor: 'transparent', border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', cursor: replacing ? 'wait' : 'pointer',
            color: 'var(--accent-primary)', fontFamily: 'inherit',
          }}>
          {replacing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UploadCloud size={14} />}
          {replacing ? 'Reemplazando...' : 'Subir imagen nueva'}
        </button>
      </Card>
    </div>
  );
};

export default ImageEditPanel;
