/* WordAPA7 — Vista previa de la portada universitaria (UNI).
   Renderiza la misma estructura que genera python/modules/portada_uni.py:
   logo centrado, area de conocimiento (20pt), titulo (Montserrat Black 20pt),
   asignatura (20pt), "Elaborado por", autores en 4 columnas con separadores
   verticales negros, docente + grupo, fecha y lugar. */
import React, { useState, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { parseAuthorEntries, COVER_FIELD_HIGHLIGHT_EVENT } from '../../lib/portadaAuthors';
import { resolveAssetUrl } from '../../api/backend';

const BLACK = '#000000';

export const UNICoverPreview: React.FC = () => {
  const portada = useDocStore((s) => s.portada);
  const [highlightField, setHighlightField] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const field = (e as CustomEvent).detail?.field as string | undefined;
      if (!field) return;
      setHighlightField(field);
      window.setTimeout(() => setHighlightField(null), 1200);
    };
    window.addEventListener(COVER_FIELD_HIGHLIGHT_EVENT, handler);
    return () => window.removeEventListener(COVER_FIELD_HIGHLIGHT_EVENT, handler);
  }, []);

  const hl = (field: string): React.CSSProperties =>
    highlightField === field
      ? { background: 'rgba(79,124,255,0.14)', boxShadow: '0 0 0 2px var(--accent-primary)', borderRadius: '4px' }
      : {};

  const autores = parseAuthorEntries(portada.author);
  const tutores = autores.filter((a) => /^(ing\.|dr\.|m\.sc\.|lic\.)/i.test(a.nombre.trim()));
  const estudiantes = autores.filter((a) => !/^(ing\.|dr\.|m\.sc\.|lic\.)/i.test(a.nombre.trim()));

  const tutorName = portada.instructor || (tutores.length > 0 ? tutores[0].nombre : '');
  const grupo = portada.grupo || '';

  // 3 columnas de estudiantes (distribución vertical, como el DOCX real)
  const studentCols: { nombre: string; carnet: string }[][] = [[], [], []];
  estudiantes.forEach((a, i) => {
    studentCols[i % 3].push(a);
  });
  const cols = [...studentCols, tutorName ? [{ nombre: tutorName, carnet: `Grupo: ${grupo}` }] : []].filter((c) => c.length > 0);

  const cellStyle: React.CSSProperties = {
    flex: 1,
    padding: '6px 10px',
    fontSize: '11pt',
    color: BLACK,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '8px 12px 4px',
        minHeight: '780px',
        fontFamily: 'Times New Roman, serif',
      }}
    >
      {/* Logo centrado */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
        <img
          src={resolveAssetUrl('/api/assets/logo_uni.png')}
          alt="Logo UNI"
          style={{ width: '150px', objectFit: 'contain' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Área de conocimiento — 20pt, centrado */}
      <p style={{ textAlign: 'center', fontSize: '20pt', color: BLACK, margin: '4px 0 24px' }}>
        Área de Conocimiento de Ingeniería y Afines
      </p>

      {/* Título — Montserrat Black 20pt */}
      <p id="cover-field-title" style={{ textAlign: 'center', fontSize: '20pt', fontWeight: 900, color: BLACK, margin: '0 0 24px', fontFamily: 'Montserrat, sans-serif', ...hl('title') }}>
        {portada.title || 'Título del trabajo'}
      </p>

      {/* Asignatura — 20pt */}
      {portada.course && (
        <p id="cover-field-course" style={{ textAlign: 'center', fontSize: '20pt', color: BLACK, margin: '0 0 40px', ...hl('course') }}>
          {portada.course}
        </p>
      )}

      {/* Elaborado por */}
      <p style={{ textAlign: 'left', fontWeight: 700, fontSize: '12pt', color: BLACK, margin: '0 0 8px', fontFamily: 'Montserrat, sans-serif' }}>
        Elaborado por
      </p>

      {/* Autores en 4 columnas con separadores verticales */}
      <div style={{ display: 'flex', borderTop: '1px solid transparent' }}>
        {cols.map((col, ci) => (
          <React.Fragment key={ci}>
            <div style={{ ...cellStyle, borderRight: ci < cols.length - 1 ? '1px solid #000' : 'none' }}>
              {col.map((a, ai) => (
                <div key={ai} style={{ marginBottom: '10px', fontFamily: 'Montserrat, sans-serif' }}>
                  <div style={{ fontSize: '11pt', fontWeight: ci === cols.length - 1 ? 700 : 400, color: BLACK }}>{a.nombre}</div>
                  {a.carnet && (
                    <div style={{ fontSize: '10pt', fontWeight: ci === cols.length - 1 ? 700 : 400, color: BLACK }}>
                      {ci === cols.length - 1 && /^Grupo/.test(a.carnet) ? a.carnet : (a.carnet.startsWith('Carnet:') || a.carnet.startsWith('Grupo:') ? a.carnet : `Carnet: ${a.carnet}`)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Fecha y lugar */}
      <p style={{ textAlign: 'left', fontSize: '12pt', color: BLACK, margin: '2px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
        {portada.date || ''}
      </p>
      <p style={{ textAlign: 'left', fontSize: '12pt', color: BLACK, margin: '0', fontFamily: 'Montserrat, sans-serif' }}>
        Managua, Nicaragua
      </p>
    </div>
  );
};

export default UNICoverPreview;
