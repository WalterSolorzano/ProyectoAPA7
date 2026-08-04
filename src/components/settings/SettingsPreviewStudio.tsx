/* WordAPA7 — Estudio de Ajustes con Previsualizador en vivo
 * Panel de controles (izquierda) + vista previa APA 7 (derecha).
 * Permite ajustar tipografía, interlineado, títulos (enumerados/bold/itálica),
 * imágenes (alineación/estilo), índice, listas y guardar plantillas de reglas y portada.
 */

import React, { useState, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { syncAllProviderKeys } from '../../api/backend';
import { Card, Badge, InputField } from '../ui/wordapa7';
import {
  Type, AlignLeft, StretchHorizontal, Heading1, Image as ImageIcon,
  ListOrdered, Save, X, BookOpen, FileText, GalleryHorizontalEnd, ListTree, ArrowRight, Cpu,
} from 'lucide-react';

const FONT_OPTIONS = [
  { value: 'Times New Roman', label: 'Times New Roman', size: 12 },
  { value: 'Calibri', label: 'Calibri', size: 11 },
  { value: 'Arial', label: 'Arial', size: 11 },
  { value: 'Georgia', label: 'Georgia', size: 11 },
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];

const SPACING_OPTIONS = [
  { value: 1.0, label: 'Sencillo 1.0' },
  { value: 1.5, label: '1.5 líneas' },
  { value: 2.0, label: 'Doble 2.0 (APA)' },
];

const NUMBERING_OPTIONS = [
  { value: 'none', label: 'Sin numerar' },
  { value: 'decimal', label: '1. 2. 3.' },
  { value: 'roman', label: 'I. II. III.' },
];

export const SettingsPreviewStudio: React.FC<{ onClose?: () => void; onContinue?: () => void }> = ({ onClose, onContinue }) => {
  const { rules, setRules, saveRuleProfile, savePortadaProfile, portada, setPortada, portadaProfiles } = useDocStore();
  const [profileName, setProfileName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  // Sincroniza las claves de IA guardadas con el backend al abrir el panel
  useEffect(() => {
    syncAllProviderKeys().catch(() => {});
  }, []);

  const hl = (lvl: number) => rules.heading_levels?.[lvl] ?? { bold: true, italic: false, alignment: 'left', indent_cm: 0, inline_text: false };
  const setHl = (lvl: number, patch: Partial<typeof rules.heading_levels[number]>) => {
    setRules({ heading_levels: { ...rules.heading_levels, [lvl]: { ...hl(lvl), ...patch } } });
  };

  const numStyle = (lvl: number) => rules[`heading_numbering_style_lvl${lvl}` as keyof typeof rules] as string || 'decimal';

  const handleSaveProfile = () => {
    const name = profileName.trim() || 'Perfil personalizado';
    saveRuleProfile(name);
    savePortadaProfile(`Portada: ${name}`);
    setSaved(`Plantilla "${name}" guardada`);
    setTimeout(() => setSaved(null), 3000);
  };

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100%',
      backgroundColor: 'var(--canvas-bg)', fontFamily: 'var(--font-family)', overflow: 'hidden',
    }}>
      {/* ── CONTROLES (izquierda) ── */}
      <div style={{
        width: '400px', flexShrink: 0, backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GalleryHorizontalEnd size={18} color="var(--accent-primary)" /> Estudio de ajustes
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Cambia los valores y mira el resultado en vivo a la derecha.
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Cerrar estudio" title="Cerrar"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}>
              <X size={20} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Guardar plantilla */}
          <Card style={{ padding: '12px', border: '1px solid rgba(79,124,255,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Save size={14} color="var(--accent-primary)" />
              <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>Guardar como plantilla</strong>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4 }}>
              Opcional. Las reglas actuales se aplican a este y a próximos documentos sin necesidad de plantilla.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <InputField
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Nombre (ej. Ensayo educativo)"
                style={{ flex: 1, fontSize: '12px', padding: '8px 10px' }}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveProfile}
                style={{ padding: '0 14px', borderRadius: '10px', flexShrink: 0 }}>Guardar</button>
            </div>
            {saved && <p style={{ fontSize: '11px', color: 'var(--accent-secondary)', marginTop: '8px' }}>✓ {saved}</p>}
            {portadaProfiles.length > 0 && (
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {portadaProfiles.length} plantilla(s) de portada guardada(s).
              </p>
            )}
          </Card>

          {/* Tipografía */}
          <Section icon={<Type size={14} />} title="Tipografía">
            <Field label="Fuente">
              <select className="form-select" value={rules.font_family}
                onChange={(e) => {
                  const f = FONT_OPTIONS.find(x => x.value === e.target.value);
                  setRules({ font_family: e.target.value, font_size_pt: f?.size ?? rules.font_size_pt });
                }}>
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="Tamaño">
              <select className="form-select" value={rules.font_size_pt}
                onChange={(e) => setRules({ font_size_pt: Number(e.target.value) })}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s} pt</option>)}
              </select>
            </Field>
          </Section>

          {/* Párrafo */}
          <Section icon={<StretchHorizontal size={14} />} title="Párrafo">
            <Field label="Interlineado">
              <select className="form-select" value={rules.line_spacing}
                onChange={(e) => setRules({ line_spacing: parseFloat(e.target.value) })}>
                {SPACING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Alineación">
              <select className="form-select" value={rules.alignment}
                onChange={(e) => setRules({ alignment: e.target.value as 'left' | 'justify' })}>
                <option value="left">Izquierda</option>
                <option value="justify">Justificado</option>
              </select>
            </Field>
            <Field label="Sangría de párrafo">
              <select className="form-select" value={rules.paragraph_indent_cm}
                onChange={(e) => setRules({ paragraph_indent_cm: parseFloat(e.target.value) })}>
                <option value={0}>Sin sangría</option>
                <option value={1.27}>1.27 cm (APA)</option>
                <option value={1.5}>1.5 cm</option>
              </select>
            </Field>
          </Section>

          {/* Títulos */}
          <Section icon={<Heading1 size={14} />} title="Títulos (niveles APA)">
            {[1, 2, 3].map(lvl => {
              const cfg = hl(lvl);
              return (
                <Card key={lvl} style={{ padding: '10px', marginBottom: '8px', background: 'var(--surface-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Badge tone="accent">Nivel {lvl}</Badge>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Toggle label="B" active={cfg.bold} onClick={() => setHl(lvl, { bold: !cfg.bold })} />
                      <Toggle label="I" active={cfg.italic} onClick={() => setHl(lvl, { italic: !cfg.italic })} />
                    </div>
                  </div>
                  <Field label="Numeración">
                    <select className="form-select" value={numStyle(lvl)}
                      onChange={(e) => setRules({ [`heading_numbering_style_lvl${lvl}`]: e.target.value } as any)}>
                      {NUMBERING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Alineación">
                    <select className="form-select" value={cfg.alignment}
                      onChange={(e) => setHl(lvl, { alignment: e.target.value as 'left' | 'center' | 'right' })}>
                      <option value="left">Izquierda</option>
                      <option value="center">Centrado</option>
                      <option value="right">Derecha</option>
                    </select>
                  </Field>
                </Card>
              );
            })}
          </Section>

          {/* Imágenes */}
          <Section icon={<ImageIcon size={14} />} title="Imágenes">
            <Field label="Alineación">
              <select className="form-select" value={rules.image_alignment || 'center'}
                onChange={(e) => setRules({ image_alignment: e.target.value as 'left' | 'center' | 'right' })}>
                <option value="center">Centrada</option>
                <option value="left">Izquierda</option>
                <option value="right">Derecha</option>
              </select>
            </Field>
            <Field label="Estilo">
              <select className="form-select" value={rules.image_style || 'plain'}
                onChange={(e) => setRules({ image_style: e.target.value as 'plain' | 'journal' })}>
                <option value="plain">Estándar APA</option>
                <option value="journal">Revista científica</option>
              </select>
            </Field>
          </Section>

          {/* Índice */}
          <Section icon={<ListTree size={14} />} title="Índice">
            <Field label="Diseño">
              <select className="form-select" value={rules.toc_style || 'apa'}
                onChange={(e) => setRules({ toc_style: e.target.value as 'apa' | 'dotted' | 'plain' })}>
                <option value="apa">APA estándar</option>
                <option value="dotted">Con puntos suspensivos</option>
                <option value="plain">Simple</option>
              </select>
            </Field>
          </Section>

          {/* Portada */}
          <Section icon={<BookOpen size={14} />} title="Portada">
            <Field label="Formato">
              <select className="form-select" value={portada.apa_format}
                onChange={(e) => setPortada({ apa_format: e.target.value as 'student' | 'professional' })}>
                <option value="student">Estudiante</option>
                <option value="professional">Profesional</option>
              </select>
            </Field>
          </Section>

          <Section icon={<Cpu size={14} />} title="Proveedores IA">
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
              Escribí tu clave y se guarda y sincroniza automáticamente con el motor (no hace falta presionar "Guardar"). Queda activa al instante para clasificación, revisor e IA.
            </p>
            <ProviderKeyField label="NVIDIA NIM" envVar="NVIDIA_API_KEY" />
            <ProviderKeyField label="Groq" envVar="GROQ_API_KEY" />
            <ProviderKeyField label="OpenRouter" envVar="OPENROUTER_API_KEY" />
            <ProviderKeyField label="Cerebras" envVar="CEREBRAS_API_KEY" />
            <ProviderKeyField label="Mistral AI" envVar="MISTRAL_API_KEY" />
            <ProviderKeyField label="OpenCodeZen" envVar="OPENCODEZEN_API_KEY" />
            <ProviderKeyField label="ZenMux" envVar="ZENMUX_API_KEY" />
            <ProviderKeyField label="Gemini" envVar="GEMINI_API_KEY" />
            <ProviderKeyField label="Cloudflare" envVar="CLOUDFLARE_API_TOKEN" />
            <ProviderKeyField label="Cloudflare Account ID" envVar="CLOUDFLARE_ACCOUNT_ID" />
          </Section>

        </div>

        {onContinue && (
          <div style={{
            flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--sidebar-bg)', display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onContinue}
              style={{
                width: '100%', padding: '13px 16px', fontSize: '14px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: 'var(--accent-primary)',
                color: '#fff', border: 'none', borderRadius: '14px',
                boxShadow: '0 10px 24px rgba(79,124,255,0.3)', cursor: 'pointer',
              }}
            >
              Continuar al Paso 1 — Portada
              <ArrowRight size={18} />
            </button>
            <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
              Las reglas ya quedan aplicadas. Guardar plantilla es opcional.
            </p>
          </div>
        )}
      </div>

      {/* ── PREVISUALIZACIÓN (derecha) ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <PreviewPaper />
      </div>
    </div>
  );
};

/* ── Sub-componentes ──────────────────────────────────────────────────────── */

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card style={{ padding: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <span style={{ color: 'var(--accent-secondary)' }}>{icon}</span>
      <strong style={{ fontSize: '12px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</strong>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
  </Card>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
    {children}
  </div>
);

/* Campo de clave de API para proveedores IA (persistida en localStorage) */
const ProviderKeyField: React.FC<{ label: string; envVar: string }> = ({ label, envVar }) => {
  const storageKey = `wordapa7-provider-key:${envVar}`;
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const [saved, setSaved] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = async (v: string) => {
    try {
      if (v.trim()) localStorage.setItem(storageKey, v.trim());
      else localStorage.removeItem(storageKey);
    } catch { /* noop */ }
    const r = await syncAllProviderKeys().catch(() => ({ ok: false as const, applied: [], error: 'Error de red' }));
    setSaved(true);
    setSyncError(r.ok ? null : (r.error || 'Error al sincronizar'));
    setTimeout(() => setSaved(false), 2000);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    setSyncError(null);
    // Autoguardado con debounce: no hace falta presionar "Guardar".
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(v), 800);
  };

  React.useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        {saved && !syncError && <span style={{ fontSize: '9px', color: 'var(--accent-success)' }}>Guardado</span>}
        {syncError && <span style={{ fontSize: '9px', color: 'var(--accent-danger)', maxWidth: '160px', textAlign: 'right' }}>{syncError}</span>}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="password"
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          autoComplete="off"
          style={{
            flex: 1, padding: '6px 8px', fontSize: '11px', fontFamily: 'monospace',
            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
            borderRadius: '6px', color: 'var(--text-main)', outline: 'none',
          }}
        />
        <button type="button" onClick={() => persist(value)}
          style={{
            padding: '6px 10px', fontSize: '10px', fontWeight: 600,
            background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
          }}>
          Guardar
        </button>
      </div>
      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{envVar}</span>
    </div>
  );
};

const Toggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick}
    style={{
      minWidth: '28px', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
      background: active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
      color: active ? '#fff' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
      fontWeight: 700, fontSize: '11px',
    }}>
    {label}
  </button>
);

/* Hoja de papel en blanco que refleja las reglas en vivo */
const PreviewPaper: React.FC = () => {
  const { rules, portada } = useDocStore();
  const font = rules.font_family || 'Times New Roman';
  const size = rules.font_size_pt || 12;
  const spacing = rules.line_spacing || 2.0;
  const alignment = rules.alignment === 'justify' ? 'justify' : 'left';
  const indent = rules.paragraph_indent_cm ? `${rules.paragraph_indent_cm}cm` : 0;

  const hlStyle = (lvl: number): React.CSSProperties => {
    const cfg = rules.heading_levels?.[lvl] ?? { bold: true, italic: false, alignment: 'left' };
    const num = rules[`heading_numbering_style_lvl${lvl}` as keyof typeof rules];
    const prefix = num === 'decimal' ? `${lvl}. ` : num === 'roman' ? (lvl === 1 ? 'I. ' : lvl === 2 ? 'II. ' : 'III. ') : '';
    const label = `${prefix}${lvl === 1 ? 'Introducción' : lvl === 2 ? 'Contexto teórico' : 'Definiciones'}`;
    return {
      fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing,
      fontWeight: cfg.bold ? 700 : 400, fontStyle: cfg.italic ? 'italic' : 'normal',
      textAlign: (cfg.alignment as React.CSSProperties['textAlign']) ?? 'left',
      margin: `${spacing * 0.5}em 0 0`,
    } as React.CSSProperties & { ['--label']?: string };
  };

  const imgAlign = rules.image_alignment || 'center';
  const imgStyle = rules.image_style || 'plain';
  const tocStyle = rules.toc_style || 'apa';

  return (
    <div style={{
      width: 'min(720px, 100%)', minHeight: '900px',
      backgroundColor: 'var(--paper-bg)', color: '#000',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)', borderRadius: '4px',
      padding: '56px', fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing,
      position: 'relative',
    }}>
      {/* Encabezado con número de página */}
      <div style={{
        position: 'absolute', top: '24px', right: '56px', fontSize: '11px',
        fontFamily: font, color: '#000',
      }}>
        {portada.apa_format === 'professional' && portada.running_head ? `${portada.running_head.toUpperCase()}    ` : ''}1
      </div>

      {/* Portada */}
      <div style={{ textAlign: 'center', marginTop: '120px', marginBottom: '80px' }}>
        <div style={{ fontWeight: 700, fontSize: '1.2em', lineHeight: 1.5 }}>Título del Trabajo Académico</div>
        <div style={{ marginTop: '24px', lineHeight: 1.8 }}>
          <div>Nombre del Estudiante</div>
          {portada.apa_format === 'student' && (
            <>
              <div>Nombre de la Institución</div>
              <div>Nombre del Curso</div>
              <div>Nombre del Instructor</div>
              <div>12 de marzo de 2026</div>
            </>
          )}
        </div>
      </div>

      {/* Índice */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05em', marginBottom: '16px' }}>Índice</div>
        {['Introducción', 'Contexto teórico', 'Metodología'].map((t, i) => (
          <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', marginBottom: '4px' }}>
            <span>{`${i + 1}. ${t}`}</span>
            <span>{tocStyle === 'dotted' ? '..........' : ''} {i + 2}</span>
          </div>
        ))}
      </div>

      {/* Título nivel 1 */}
      <div {...{ 'data-lvl': '1' } as any} style={hlStyle(1)}>Introducción</div>
      <p style={{ fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing, textAlign: alignment, textIndent: indent, margin: '0 0 0.5em' }}>
        Este es un párrafo de ejemplo que muestra cómo se verá el cuerpo del documento con la fuente,
        el interlineado y la alineación seleccionados. Cualquier cambio en los controles se refleja
        al instante en esta vista previa (Pérez, 2023).
      </p>
      <p style={{ fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing, textAlign: alignment, textIndent: indent, margin: '0 0 0.5em' }}>
        Un segundo párrafo confirma la sangría de primera línea, el interlineado {spacing.toFixed(1).replace('.', ',')}
        y el estilo tipográfico {font} a {size} puntos.
      </p>

      {/* Título nivel 2 */}
      <div {...{ 'data-lvl': '2' } as any} style={hlStyle(2)}>Contexto teórico</div>
      <p style={{ fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing, textAlign: alignment, textIndent: indent, margin: '0 0 0.5em' }}>
        La revisión de la literatura fundamenta el análisis del problema. Las fuentes se citan en el
        formato autor-fecha de la séptima edición de APA (García & López, 2021).
      </p>

      {/* Lista numerada */}
      <div style={{ fontSize: '0.9em', lineHeight: spacing, marginLeft: '1.5em' }}>
        <div>1. Primer elemento de la lista numerada.</div>
        <div>2. Segundo elemento de la lista numerada.</div>
        <div>3. Tercer elemento de la lista numerada.</div>
      </div>

      {/* Título nivel 3 */}
      <div {...{ 'data-lvl': '3' } as any} style={hlStyle(3)}>Definiciones</div>
      <p style={{ fontFamily: font, fontSize: `${size}pt`, lineHeight: spacing, textAlign: alignment, textIndent: indent, margin: '0 0 0.5em' }}>
        Las definiciones operativas delimitan el alcance del estudio.
      </p>

      {/* Figura */}
      <div style={{ textAlign: imgAlign, margin: '24px 0' }}>
        <div style={{
          display: 'inline-block',
          border: imgStyle === 'journal' ? '2px solid #000' : '1px dashed #999',
          padding: imgStyle === 'journal' ? '4px' : '12px',
          borderRadius: imgStyle === 'journal' ? '2px' : '6px',
          backgroundColor: '#f4f4f5',
        }}>
          <div style={{ width: imgStyle === 'journal' ? '220px' : '260px', height: '90px', backgroundColor: '#e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: '11px' }}>
            [Imagen de ejemplo]
          </div>
        </div>
        <div style={{ fontSize: '0.85em', fontStyle: 'italic', marginTop: '6px' }}>Figura 1. Ejemplo de figura {imgStyle === 'journal' ? 'con marco de revista científica.' : 'con estilo estándar APA.'}</div>
      </div>

      {/* Tabla */}
      <div style={{ margin: '24px 0', fontSize: '0.85em' }}>
        <div style={{ fontWeight: 700, fontStyle: 'italic', marginBottom: '6px' }}>Tabla 1</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', borderBottom: '1px solid #000', fontFamily: font }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '4px' }}>Variable</th>
              <th style={{ textAlign: 'left', padding: '4px' }}>Media</th>
              <th style={{ textAlign: 'left', padding: '4px' }}>DE</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '4px' }}>Grupo A</td><td style={{ padding: '4px' }}>4.2</td><td style={{ padding: '4px' }}>0.8</td></tr>
            <tr><td style={{ padding: '4px' }}>Grupo B</td><td style={{ padding: '4px' }}>5.1</td><td style={{ padding: '4px' }}>0.6</td></tr>
          </tbody>
        </table>
      </div>

      {/* Referencias */}
      <div style={{ marginTop: '48px' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05em', marginBottom: '12px' }}>Referencias</div>
        <div style={{ fontSize: '0.85em', marginLeft: '1.27cm', textIndent: '-1.27cm', marginBottom: '6px' }}>
          García, J., & López, M. (2021). <i>Métodos de investigación</i>. Editorial Académica.
        </div>
        <div style={{ fontSize: '0.85em', marginLeft: '1.27cm', textIndent: '-1.27cm', marginBottom: '6px' }}>
          Pérez, A. (2023). La escritura académica en el siglo XXI. <i>Revista de Educación</i>, 12(2), 45-60.
        </div>
      </div>
    </div>
  );
};

export default SettingsPreviewStudio;
