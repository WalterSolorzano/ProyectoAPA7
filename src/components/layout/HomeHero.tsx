/* WordAPA7 — Hero de la pantalla de inicio (Centro Editorial Académico).
 * Diseño Fluent 2 de alta calidad académica: título editorial, subtítulo
 * descriptivo y pilares de confianza con verificación formal APA 7ma Edición.
 * Cero emojis: cumplimiento estricto con las directrices del proyecto.
 */

import React from 'react';
import { ShieldCheck, FileCheck, BadgeCheck, Sparkles } from 'lucide-react';

export const HomeHero: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0 24px', maxWidth: '820px', margin: '0 auto' }}>
      {/* Badge de norma */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 14px',
        borderRadius: '999px',
        background: 'var(--color-accent-soft)',
        border: '1px solid var(--accent-primary)',
        color: 'var(--accent-primary)',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        letterSpacing: '0.02em',
        marginBottom: '16px',
      }}>
        <Sparkles size={13} strokeWidth={2.2} />
        <span>Normas APA 7ª Edición · Motor Editorial Certificado</span>
      </div>

      {/* Título Principal Académico */}
      <h1 style={{
        fontSize: '32px',
        fontWeight: 800,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        color: 'var(--text-main)',
        margin: '0 auto 12px',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}>
        Estandarización y Formato APA 7ma Edición
      </h1>

      {/* Subtítulo Descriptivo */}
      <p style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        margin: '0 auto 20px',
        maxWidth: '680px',
        lineHeight: 1.6,
        fontWeight: 400,
      }}>
        Normalizá tesis, monografías, artículos científicos e informes técnicos con márgenes de 2.54 cm,
        sangría de 1.27 cm, interlineado doble y validación cruzada de citas bibliográficas.
      </p>

      {/* 3 Pilares de Garantía Editorial */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          <ShieldCheck size={14} color="var(--accent-primary)" strokeWidth={2} />
          <span>100% Preservación de Contenido</span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          <FileCheck size={14} color="var(--accent-success)" strokeWidth={2} />
          <span>Tipografía & Jerarquía de Títulos</span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          <BadgeCheck size={14} color="var(--accent-primary)" strokeWidth={2} />
          <span>Auditoría de Citas & DOI</span>
        </div>
      </div>
    </div>
  );
};

export default HomeHero;
