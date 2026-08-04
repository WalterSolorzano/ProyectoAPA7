/* WordAPA7 — Cover Setup Dialog
   Setup de portada en 3 columnas: conservar original, plantilla o APA 7 del programa.
   Estilo alineado con la pantalla de inicio (Step0QuickStart): superficies suaves,
   acento único azul, miniaturas CSS para plantillas integradas.
*/

import React, { useState, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  ShieldCheck,
  FileText,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import * as api from '../../api/backend';
import type { CoverTemplateInfo } from '../../api/backend';
import { Badge } from '../ui/wordapa7';

export const CoverSetupDialog: React.FC = () => {
  const { doc, portada, setPortada, coverSetupDone, setCoverSetupDone } = useDocStore();

  const [templates, setTemplates] = useState<CoverTemplateInfo[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  // Detección: la portada es la primera hoja.
  const portadaDetected = Boolean(
    doc?.portada?.detected ||
    doc?.meta?.portada_detected ||
    (doc?.meta?.page_count_exact === true && doc?.elements?.some((e) => e.is_cover_section))
  );

  const fields: Record<string, string> = doc?.portada?.fields || {};
  const detectedTitle = fields.title || portada.title || '';

  useEffect(() => {
    if (!showTemplates) return;
    let cancelled = false;
    setLoadingTemplates(true);
    setTemplatesError(false);
    api.fetchCoverTemplates()
      .then((list) => { if (!cancelled) setTemplates(list); })
      .catch(() => { if (!cancelled) setTemplatesError(true); })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, [showTemplates]);

  if (coverSetupDone) return null;

  const handleKeepOriginal = () => {
    setPortada({ use_original_cover: true, force_skip_cover: false });
    setCoverSetupDone(true);
  };

  const handleUseProgram = () => {
    setPortada({ use_original_cover: false, force_skip_cover: false });
    setCoverSetupDone(true);
  };

  const handleUseUni = () => {
    setPortada({
      use_original_cover: false,
      force_skip_cover: false,
      cover_mode: 'generate_uni_cover',
    });
    setCoverSetupDone(true);
  };

  const handleSelectTemplate = async (t: CoverTemplateInfo) => {
    if (!doc) return;
    setApplying(t.name);
    try {
      const result = await api.applyCover({
        session_id: doc.session_id,
        cover_template_name: t.name,
        title: portada.title || '',
        author: portada.author || '',
        institution: portada.institution || '',
        course: portada.course || '',
        instructor: portada.instructor || '',
        date: portada.date || '',
      });
      if (result.document) {
        useDocStore.getState().pushHistory(result.document);
        useDocStore.setState((s) => ({
          doc: result.document,
          portada: {
            ...s.portada,
            use_original_cover: false,
            force_skip_cover: true,
            cover_template_id: t.name,
          },
        }));
      } else {
        setPortada({ use_original_cover: false, force_skip_cover: true, cover_template_id: t.name });
      }
      setCoverSetupDone(true);
    } catch (err: any) {
      console.error('Error applying cover:', err);
      useDocStore.getState().showToast(
        err.message || `Error al aplicar la portada "${t.name}"`, 'error'
      );
    } finally {
      setApplying(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 21000,
      background: 'rgba(5, 5, 8, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: 'min(880px, 100%)',
        maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Badge tone={portadaDetected ? 'accent' : 'warning'}>
              {portadaDetected ? 'Primera hoja detectada' : 'Sin portada detectada'}
            </Badge>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
              Portada del documento
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {portadaDetected
              ? 'Elegimos cómo tratar la primera hoja antes de aplicar el formato APA 7.'
              : 'No detectamos una portada en la primera hoja. Puedes crear una o elegir una plantilla.'}
          </p>
        </div>

        {/* Body — 3 columnas */}
        <div style={{ padding: '24px 28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}>

            {/* Opción A: Conservar original */}
            <OptionCard
              icon={<ShieldCheck size={20} />}
              title="Conservar portada actual"
              description={
                portadaDetected
                  ? `Mantengo la primera hoja intacta.${detectedTitle ? ` Detecté: "${detectedTitle}"` : ''}`
                  : 'Mantengo la primera hoja tal como está.'
              }
              badge={portadaDetected ? 'Intacta' : undefined}
              onClick={handleKeepOriginal}
            />

            {/* Opción B: Plantillas */}
            <OptionCard
              icon={<FileText size={20} />}
              title="Usar una plantilla"
              description="Elige una portada pre-diseñada de la biblioteca del programa."
              badge="Plantillas"
              expandable
              expanded={showTemplates}
              onToggle={() => setShowTemplates((s) => !s)}
              loading={loadingTemplates}
              error={templatesError}
              retry={() => setShowTemplates(false)}
            >
              {showTemplates && !loadingTemplates && !templatesError && templates.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {templates.map((t) => (
                    <TemplateThumb
                      key={t.name}
                      template={t}
                      applying={applying === t.name}
                      disabled={applying !== null}
                      onSelect={() => handleSelectTemplate(t)}
                    />
                  ))}
                </div>
              )}
            </OptionCard>

            {/* Opción C: APA 7 del programa */}
            <OptionCard
              icon={<span style={{ fontSize: '18px', fontWeight: 900 }}>1</span>}
              title="Portada APA 7 del programa"
              description="Genero una portada con formato APA 7: título, autores, institución, curso, docente y fecha. Editarás los campos en el siguiente paso."
              badge="APA 7"
              highlight
              onClick={handleUseProgram}
            />

            {/* Opción D: Portada universitaria institucional */}
            <OptionCard
              icon={<span style={{ fontSize: '18px', fontWeight: 900 }}>U</span>}
              title="Portada de mi universidad"
              description="Portada institucional tipo UNI: logo, área de conocimiento, asignatura, título, autores con carnet, docente, grupo, fecha y lugar. Los datos los completas con tu biblioteca de integrantes."
              badge="Institucional"
              onClick={handleUseUni}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" type="button"
            onClick={handleKeepOriginal}
            style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Decidir después
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverSetupDialog;


/* ═══════════════════════════════════════════════════════════════════════════
   Tarjeta de opción
   ═══════════════════════════════════════════════════════════════════════════ */

const OptionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  highlight?: boolean;
  onClick?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  loading?: boolean;
  error?: boolean;
  retry?: () => void;
  children?: React.ReactNode;
}> = ({ icon, title, description, badge, highlight, onClick, expandable, expanded, onToggle, loading, error, retry, children }) => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${highlight ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
    borderRadius: '14px', padding: '16px',
    gap: '10px',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: highlight ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
        color: highlight ? '#fff' : 'var(--text-main)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h4>
          {badge && (
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
              textTransform: 'uppercase', letterSpacing: '0.3px',
              background: highlight ? 'rgba(79,124,255,0.18)' : 'rgba(255,255,255,0.06)',
              color: highlight ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}>{badge}</span>
          )}
        </div>
      </div>
    </div>
    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', flex: 1 }}>
      {description}
    </p>

    {expandable && (
      <div style={{ marginTop: 'auto' }}>
        <button className={expanded ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'} type="button"
          onClick={onToggle}
          style={{ fontSize: '12px' }}>
          {expanded ? 'Ocultar opciones' : 'Ver opciones'}
        </button>

        {expanded && loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px', padding: '10px 0' }}>
            <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Cargando...
          </div>
        )}
        {expanded && error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-warning)', fontSize: '12px', padding: '10px 0' }}>
            <AlertTriangle size={14} />
            No se pudieron cargar las plantillas.
            <button className="btn btn-ghost btn-sm" type="button" onClick={retry} style={{ fontSize: '11px' }}>Reintentar</button>
          </div>
        )}
        {expanded && !loading && !error && (
          <div style={{ marginTop: '12px' }}>
            {children}
          </div>
        )}
      </div>
    )}

    {!expandable && onClick && (
      <button className={highlight ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} type="button"
        onClick={onClick}
        style={{ fontSize: '12px', marginTop: 'auto' }}>
        Elegir
      </button>
    )}
  </div>
);


/* ═══════════════════════════════════════════════════════════════════════════
   Miniatura de plantilla — con fallback CSS para plantillas integradas
   ═══════════════════════════════════════════════════════════════════════════ */

const TemplateThumb: React.FC<{ template: CoverTemplateInfo; applying: boolean; disabled: boolean; onSelect: () => void }> = ({ template, applying, disabled, onSelect }) => {
  const sourceLabel = template.source_type === 'image' ? 'Imagen'
    : template.source_type === 'docx' ? 'Word'
    : 'APA';

  return (
    <button type="button" onClick={onSelect} disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px', padding: 0, cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        overflow: 'hidden', transition: 'border-color 0.15s ease',
        display: 'flex', flexDirection: 'column', opacity: disabled && !applying ? 0.6 : 1,
      }}>
      <div style={{ height: '120px', position: 'relative', borderBottom: '1px solid var(--border-subtle)' }}>
        {template.preview_path ? (
          <img
            src={api.getCoverPreviewUrl(template.name) + '?t=' + Date.now()}
            alt={template.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <BuiltinThumb name={template.name} />
        )}
        <span style={{
          position: 'absolute', top: '6px', left: '6px', fontSize: '9px', fontWeight: 700,
          background: template.is_builtin ? 'rgba(79,124,255,0.2)' : 'rgba(255,255,255,0.08)',
          color: template.is_builtin ? 'var(--accent-primary)' : 'var(--text-muted)',
          padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.3px',
        }}>
          {sourceLabel}
        </span>
        {applying && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,8,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={20} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.name}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Check size={10} /> Aplicar
        </div>
      </div>
    </button>
  );
};


/* ═══════════════════════════════════════════════════════════════════════════
   Miniatura CSS de plantilla integrada (sin preview real)
   ═══════════════════════════════════════════════════════════════════════════ */

const BuiltinThumb: React.FC<{ name: string }> = ({ name }) => {
  const lower = name.toLowerCase();
  const isProfessional = lower.includes('profesional');
  const isMinimal = lower.includes('minimal');
  const hasLogo = lower.includes('logo');

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '6px', padding: '14px', boxSizing: 'border-box',
    }}>
      {isProfessional && (
        <span style={{ fontSize: '7px', letterSpacing: '1px', textTransform: 'uppercase', color: '#a1a1aa', alignSelf: 'flex-start' }}>
          Running head
        </span>
      )}
      {hasLogo && (
        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#4f7cff' }} />
      )}
      <div style={{ width: '70%', height: '6px', borderRadius: '3px', background: '#d4d4d8' }} />
      <div style={{ width: '45%', height: '6px', borderRadius: '3px', background: '#d4d4d8' }} />
      {isMinimal && <div style={{ width: '50%', height: '2px', background: '#4f7cff', marginTop: '4px' }} />}
      {!isMinimal && (
        <div style={{ width: '55%', height: '4px', borderRadius: '2px', background: '#e4e4e7', marginTop: '2px' }} />
      )}
    </div>
  );
};
