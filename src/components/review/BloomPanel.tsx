import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { type ObjetivoBloom, reemplazarVerbo } from '../../lib/contentReview';

export interface BloomPanelProps {
  objetivos: readonly ObjetivoBloom[];
  /** Aplica el verbo elegido al elemento del documento. Sin acción: solo lectura. */
  onAplicar?: (elementId: string, texto: string) => void;
}

/* Eje fijo de la taxonomía. El nombre recuerda el nivel; el marcador dice dónde
   está cada objetivo, no una barra: una barra horizontal mediría cantidad, y acá
   lo que importa es el nivel. */
const NIVELES = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'];

const COLUMNAS = 'minmax(180px, 1.1fr) repeat(6, minmax(0, 1fr))';

const eje: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLUMNAS,
  alignItems: 'center',
  gap: 4,
};

const etiquetaNivel: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--color-text-tertiary)',
  textAlign: 'center',
};

const fila: React.CSSProperties = {
  ...eje,
  padding: '10px 0',
  borderTop: '1px solid var(--color-border-subtle)',
};

const textoBase: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-primary)',
  minWidth: 0,
  lineHeight: 1.35,
};

const prefijo: React.CSSProperties = {
  color: 'var(--color-text-tertiary)',
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
};

function esHallazgo(o: ObjetivoBloom): boolean {
  return o.sinVariable || o.tieneDosVerbos || o.nivelActual === null || o.nivelActual < o.nivelPropuesto;
}

function primerToken(texto: string): { verbo: string; resto: string } {
  const m = (texto || '').match(/^(\S+)([\s\S]*)$/);
  return m ? { verbo: m[1], resto: m[2] } : { verbo: texto || '', resto: '' };
}

function marcador(hallazgo: boolean): React.CSSProperties {
  return hallazgo
    ? { width: 14, height: 14, borderRadius: 'var(--radius-full)', border: '2px solid var(--color-warning)' }
    : { width: 14, height: 14, borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-accent)' };
}

const marcaGuia: React.CSSProperties = {
  width: 6,
  height: 2,
  borderRadius: 'var(--radius-xs)',
  backgroundColor: 'var(--color-border-subtle)',
};

const chip = (activo: boolean): React.CSSProperties => ({
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  padding: '3px 9px',
  borderRadius: 'var(--radius-full)',
  border: `1px solid ${activo ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
  backgroundColor: activo ? 'var(--color-accent-a20)' : 'transparent',
  color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  cursor: 'pointer',
});

const botonAplicar = (apagado: boolean): React.CSSProperties => ({
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  padding: '4px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-accent)',
  backgroundColor: apagado ? 'var(--color-bg-surface-alt)' : 'var(--color-accent)',
  color: apagado ? 'var(--color-text-tertiary)' : 'var(--color-text-on-accent)',
  cursor: apagado ? 'not-allowed' : 'pointer',
});

const ObjetivoFila: React.FC<{
  o: ObjetivoBloom;
  etiqueta: string;
  onAplicar?: (elementId: string, texto: string) => void;
}> = ({ o, etiqueta, onAplicar }) => {
  const [elegido, setElegido] = useState<string | null>(null);
  const hallazgo = esHallazgo(o);
  const col = o.nivelActual ?? 1;
  const { verbo, resto } = primerToken(o.texto);

  return (
    <div>
      <div style={fila}>
        <div style={textoBase}>
          <span style={prefijo}>{etiqueta} · </span>
          <strong>{verbo}</strong>
          {resto}
        </div>
        {NIVELES.map((_, idx) => {
          const nivel = idx + 1;
          return (
            <div key={nivel} style={{ display: 'flex', justifyContent: 'center' }}>
              {nivel === col ? <span style={marcador(hallazgo)} /> : <span style={marcaGuia} />}
            </div>
          );
        })}
      </div>

      <p
        style={{
          margin: '2px 0 0',
          fontSize: 'var(--text-xs)',
          color: hallazgo ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
        }}
      >
        {o.analisis}
      </p>

      {hallazgo && o.alternativas.length > 0 && onAplicar && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, marginBottom: 2 }}>
          {o.alternativas.map((alt) => (
            <button key={alt} type="button" aria-pressed={elegido === alt} onClick={() => setElegido(alt)} style={chip(elegido === alt)}>
              {alt}
            </button>
          ))}
          <button
            type="button"
            disabled={!elegido}
            onClick={() => elegido && onAplicar(o.elementId, reemplazarVerbo(o.texto, elegido))}
            style={botonAplicar(!elegido)}
          >
            Aplicar la alternativa elegida
          </button>
        </div>
      )}
    </div>
  );
};

export function BloomPanel({ objetivos, onAplicar }: BloomPanelProps) {
  if (objetivos.length === 0) {
    return <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No se detectaron objetivos.</p>;
  }

  let nEsp = 0;
  const filas = objetivos.map((o) => {
    const etiqueta = o.esGeneral ? 'General' : `Específico ${++nEsp}`;
    return { o, etiqueta };
  });
  const pendientes = filas.filter((f) => esHallazgo(f.o)).length;

  return (
    <div>
      <div style={{ ...eje, paddingBottom: 4 }}>
        <div />
        {NIVELES.map((n) => (
          <div key={n} style={etiquetaNivel}>{n}</div>
        ))}
      </div>

      {filas.map(({ o, etiqueta }) => (
        <ObjetivoFila key={o.elementId} o={o} etiqueta={etiqueta} onAplicar={onAplicar} />
      ))}

      {pendientes === 0 ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={13} aria-hidden /> Los objetivos sostienen un nivel medible.
        </p>
      ) : (
        <p style={{ margin: '10px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
          {pendientes} de {objetivos.length} objetivos necesitan ajuste.
        </p>
      )}
    </div>
  );
}
