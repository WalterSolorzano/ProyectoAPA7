/**
 * El escenario: UNA figura a la vez, a la escala de la hoja.
 *
 * POR QUE LA FIGURA Y NO EL DOCUMENTO. El centro de esta pantalla era el papel
 * entero, que es lo que ya se puede ver en el paso de Revisión. Con veinte
 * figuras de golpe —el caso que la F7 le va a meter— veinte páginas de papel son
 * veinte clicks para llegar a la figura, y la lista de la izquierda es lo único
 * que realmente se recorre. Acá el centro es la figura activa, y el documento
 * entra por un toggle APAGADO POR OMISION, igual que hizo F3 con su índice.
 *
 * LA ESCALA ES DE LA HOJA, NO DE LA CAJA. `max-width: 100%` dice "que entre", y
 * una figura de 4 cm que entra en la columna se ve enorme y sale de 4 cm. Lo que
 * se ve tiene que ser lo que sale, así que la caja sale de `medidaDeFigura`, que
 * es la geometría de la hoja de la F2. Y si el documento NO declara tamaño, no
 * se inventa uno: se dice, y la altura la pone la proporción natural del
 * archivo.
 *
 * LA LEYENDA SE GUARDA AL SALIR DEL CAMPO, NO EN CADA TECLA. `updateElementImage`
 * es una llamada HTTP con `pushHistory`, y con `caption` corre
 * `cleanRedundantTitleParagraphs`, que reescribe párrafos del documento. Escribir
 * la leyenda letra por letra es un PATCH por letra que reescribe el documento
 * letra por letra.
 *
 * `PaperCanvas` NO se importa acá: entra por prop `documento`, igual que en
 * `EscritorioEstructura` de la F3. Quien compone es quien sabe qué es "el
 * documento" en esta pantalla, y por eso esta prueba no monta el lienzo.
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon } from 'lucide-react';
import { resolveAssetUrl } from '../../api/backend';
import { medidaDeFigura, type ContextoFigura } from '../../lib/figuras';

export type VistaFiguras = 'figura' | 'documento';

/** Por omision se ve la FIGURA. El documento es la referencia, no el eje (§8.1). */
export const VISTA_POR_DEFECTO: VistaFiguras = 'figura';

export function porDefectoSeVeElDocumento(): boolean {
  return VISTA_POR_DEFECTO === 'documento';
}

/** Cuantas filas y columnas de una tabla se ven antes de cortar. */
const FILAS_DE_TABLA = 6;
const COLUMNAS_DE_TABLA = 6;

export interface EscenarioFiguraProps {
  contexto: ContextoFigura | null;
  totalEnDocumento: number;
  onNavigate: (paso: 1 | -1) => void;
  /** Se llama al perder el foco, nunca en cada tecla. */
  onLegendChange: (texto: string) => void;
  /** El documento entero, como contenido del toggle. */
  documento?: ReactNode;
}

/** La figura, con la caja que le toca en la hoja y el aviso si no hay tamaño. */
function FiguraAColumnaDeLaHoja({ c }: { c: ContextoFigura }) {
  const url = c.url ? resolveAssetUrl(c.url) : null;
  const medida = medidaDeFigura(
    c.anchoCm !== null && c.altoCm !== null
      ? { width_cm: c.anchoCm, height_cm: c.altoCm }
      : null,
  );

  /* Si tiene subfiguras (multipanel), se renderiza la composición (a, b, etc.) */
  if (c.designStyle === 'multipanel' && c.subfigures && c.subfigures.length > 0) {
    return (
      <div data-testid="escenario-figura-imagen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0, width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: c.subfigures.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', width: '100%', maxWidth: `${medida.anchoPx}px` }}>
          {c.subfigures.map((sub, i) => {
            const subUrl = sub.relative_url ? resolveAssetUrl(sub.relative_url) : url;
            return (
              <div key={sub.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {subUrl ? (
                  <img
                    src={subUrl}
                    alt={sub.label}
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'contain',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--paper-white)',
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface-subtle)', border: '1px dashed var(--border-subtle)' }}>
                    <ImageIcon size={20} strokeWidth="var(--icon-stroke)" />
                  </div>
                )}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--paper-ink)' }}>
                  {sub.label} {sub.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="escenario-figura-imagen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
      {url ? (
        <img
          src={url}
          alt={c.rotulo}
          style={{
            /* La caja mide lo que mide en la hoja. Sin tamano declarado NO hay
               alto fijo: la altura la pone la proporcion natural del archivo, y un
               12 x 8 inventado seria una figura que miente sobre lo que sale. */
            width: `${medida.anchoPx}px`,
            height: medida.declarada ? `${medida.altoPx}px` : 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            border: '1px solid var(--color-paper-border-dashed)',
            backgroundColor: 'var(--paper-white)',
            color: 'var(--paper-ink)',
          }}
        />
      ) : (
        <div
          style={{
            width: `${medida.anchoPx}px`, maxWidth: '100%', minHeight: '80px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed var(--color-paper-border-dashed)',
            backgroundColor: 'var(--surface-subtle)', color: 'var(--color-text-tertiary)',
          }}
        >
          <ImageIcon size={24} strokeWidth="var(--icon-stroke)" aria-hidden />
        </div>
      )}
      {!medida.declarada && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
          Sin tamaño declarado en el documento
        </span>
      )}
    </div>
  );
}

/** Las celdas de `table_info`. Un icono de tabla no es un dato (§8.1). */
function TablaDelEscenario({ c }: { c: ContextoFigura }) {
  const filas = c.tabla?.rows ?? [];
  const headers = c.tabla?.headers ?? [];
  if (filas.length === 0) {
    return (
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', padding: 'var(--space-6)' }}>
        Esta tabla no trae datos en el documento
      </div>
    );
  }
  const mostradas = filas.slice(0, FILAS_DE_TABLA);
  const columnas = Math.min(
    COLUMNAS_DE_TABLA,
    Math.max(headers.length, ...filas.map((f) => f.length), 0),
  );
  const cortadas = filas.length > FILAS_DE_TABLA || columnas < Math.max(headers.length, ...filas.map((f) => f.length), 0);
  return (
    <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {Array.from({ length: columnas }, (_, i) => (
              <th
                key={i}
                title={headers[i]}
                style={{
                  fontSize: 'var(--text-xs)', fontWeight: 700, textAlign: 'left',
                  color: 'var(--paper-ink)', borderBottom: '1px solid var(--color-paper-border-subtle)',
                  padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {headers[i] ?? ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mostradas.map((fila, f) => (
            <tr key={f}>
              {Array.from({ length: columnas }, (_, i) => (
                <td
                  key={i}
                  title={fila[i]}
                  style={{
                    fontSize: 'var(--text-xs)', color: 'var(--paper-ink)', padding: '2px 6px',
                    borderBottom: '1px solid var(--color-paper-border-subtle)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {fila[i] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {cortadas && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
          Mostrando {mostradas.length} de {filas.length} filas
        </div>
      )}
    </div>
  );
}

/** El campo de leyenda: estado local, y commit al salir. Nunca por tecla. */
function CampoDeLeyenda({ c, onLegendChange }: { c: ContextoFigura; onLegendChange: (t: string) => void }) {
  const [borrador, setBorrador] = useState(c.leyenda);
  /* Se resincroniza cuando cambia la figura, y NO mientras la persona escribe: sin
     esto el campo queda con el texto de la figura anterior, que es peor que un
     fetch por letra. */
  useEffect(() => { setBorrador(c.leyenda); }, [c.id, c.leyenda]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0, width: '100%' }}>
      <label htmlFor={`leyenda-${c.id}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Leyenda de la figura
      </label>
      <textarea
        id={`leyenda-${c.id}`}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => { if (borrador !== c.leyenda) onLegendChange(borrador); }}
        rows={2}
        placeholder={`${c.rotulo}. Describa la figura según APA 7…`}
        style={{
          fontFamily: 'inherit', fontSize: 'var(--text-sm)', resize: 'vertical', minWidth: 0,
          padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-elevated)', color: 'var(--text-main)',
          border: `1px solid ${c.tieneLeyenda ? 'var(--border-subtle)' : 'var(--color-warning-a40)'}`,
        }}
      />
      {!c.tieneLeyenda && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
          Sin leyenda - APA 7 la exige
        </span>
      )}
    </div>
  );
}

export function EscenarioFigura({
  contexto, totalEnDocumento, onNavigate, onLegendChange, documento,
}: EscenarioFiguraProps) {
  const [vista, setVista] = useState<VistaFiguras>(VISTA_POR_DEFECTO);

  /* Con una sola figura del tipo, la flecha de avance no tiene destino y un boton
     que no hace nada es un control que hay que adivinar: no se pintan. El conteo
     del tipo vive en el contexto, que es donde se cuenta una sola vez. */
  const totalEnTipo = contexto?.totalEnTipo ?? 0;
  const hayAnterior = totalEnTipo > 1;
  const verElDocumento = vista === 'documento';

  return (
    <div
      data-testid="escenario-figura"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0, maxHeight: '12vh',
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {contexto ? `${contexto.h1 ?? 'Portada'}${contexto.h2 ? ` > ${contexto.h2}` : ''}` : 'Sin figura elegida'}
        </span>
        {contexto && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
            {contexto.rotulo} · {contexto.posicionEnSeccion} de {contexto.totalEnSeccion} en esta sección ·{' '}
            {contexto.posicionEnTipo} de {totalEnTipo} de este tipo · {totalEnDocumento} en el documento
          </span>
        )}
        <button
          type="button"
          onClick={() => setVista(verElDocumento ? 'figura' : 'documento')}
          aria-pressed={verElDocumento}
          title={verElDocumento ? 'Volver a la figura activa' : 'Ver el documento entero como referencia'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', flexShrink: 0,
            fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: verElDocumento ? 'var(--color-accent-soft)' : 'transparent',
            border: `1px solid ${verElDocumento ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            color: verElDocumento ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
          }}
        >
          {verElDocumento
            ? <><ImageIcon size={12} strokeWidth="var(--icon-stroke)" aria-hidden /> Ver la figura</>
            : <><FileText size={12} strokeWidth="var(--icon-stroke)" aria-hidden /> Ver el documento</>}
        </button>
      </div>

      {/* El scroller. `minHeight: 0` y `minWidth: 0`: sin el primero un hijo con
          `flex: 1` no baja de su alto de contenido, y sin el segundo un hijo
          ancho estira la columna. */}
      <div
        data-testid="escenario-scroller"
        style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', padding: 'var(--space-6)', backgroundColor: 'var(--canvas-bg)' }}
      >
        {verElDocumento ? (
          <div style={{ minHeight: 0, minWidth: 0 }}>{documento}</div>
        ) : contexto === null ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Elegí una figura en la lista para verla aquí con su contexto
            </p>
            <p style={{ margin: 0, marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
              La lista queda a la izquierda con el tamaño, la leyenda y el párrafo de cada figura.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center', minWidth: 0, width: '100%' }}>
            {/* Hoja de papel APA 7 con contexto vivo */}
            <div
              style={{
                width: '100%',
                maxWidth: '680px',
                backgroundColor: 'var(--paper-white)',
                color: 'var(--paper-ink)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-md)',
                padding: 'var(--space-8) var(--space-6)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'serif',
                minWidth: 0,
              }}
            >
              {/* Contexto: Párrafo Previo */}
              <div style={{ marginBottom: 'var(--space-4)', opacity: 0.85, fontSize: 'var(--text-sm)', lineHeight: 1.6, textAlign: 'justify' }}>
                <p style={{ margin: 0, textIndent: '1.27cm' }}>
                  {contexto.parrafoAnterior ?? '... (Párrafo anterior del documento donde se introduce la figura según lineamientos APA 7) ...'}
                </p>
              </div>

              {/* Rótulo y Título de la Figura según APA 7 */}
              <div style={{ margin: 'var(--space-4) 0 var(--space-2)', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--paper-ink)' }}>
                  {contexto.rotulo}
                </div>
                <div style={{ fontStyle: 'italic', fontSize: 'var(--text-sm)', color: 'var(--paper-ink)', marginTop: 2 }}>
                  {contexto.leyenda ? contexto.leyenda : 'Título descriptivo de la figura'}
                </div>
              </div>

              {/* Render de la Figura o Tabla */}
              <div style={{ margin: 'var(--space-2) 0', display: 'flex', justifyContent: 'center' }}>
                {contexto.tipo === 'image' ? <FiguraAColumnaDeLaHoja c={contexto} /> : <TablaDelEscenario c={contexto} />}
              </div>

              {/* Nota de la Figura APA 7 */}
              <div style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)', lineHeight: 1.4, color: 'var(--paper-ink)' }}>
                <span style={{ fontStyle: 'italic', fontWeight: 600 }}>Nota.</span> Elaboración propia basada en los datos del estudio.
              </div>

              {/* Contexto: Párrafo Posterior */}
              <div style={{ marginTop: 'var(--space-4)', opacity: 0.85, fontSize: 'var(--text-sm)', lineHeight: 1.6, textAlign: 'justify' }}>
                <p style={{ margin: 0, textIndent: '1.27cm' }}>
                  {contexto.parrafoSiguiente ?? '... (Párrafo subsiguiente donde continúa el análisis e interpretación de los resultados en el documento) ...'}
                </p>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '680px', minWidth: 0 }}>
              <CampoDeLeyenda c={contexto} onLegendChange={onLegendChange} />
            </div>

            <div style={{ width: '100%', maxWidth: '680px', minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Párrafo anterior detectado
              </span>
              <p style={{ margin: '2px 0 0', lineHeight: 1.45 }}>
                {contexto.parrafoAnterior ?? 'Es la primera figura de la sección: no hay párrafo que la presente'}
              </p>
            </div>
          </div>
        )}
      </div>

      {hayAnterior && !verElDocumento && contexto && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            aria-label="Figura anterior"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 'var(--radius-sm)', backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)', color: 'var(--color-text-secondary)',
            }}
          >
            <ChevronLeft size={12} strokeWidth="var(--icon-stroke)" aria-hidden /> Figura anterior
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            {contexto.posicionEnSeccion} de {contexto.totalEnSeccion} en esta sección
          </span>
          {contexto.posicionEnTipo < totalEnTipo && (
            <button
              type="button"
              onClick={() => onNavigate(1)}
              aria-label="Figura siguiente"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-sm)', backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)', color: 'var(--color-text-secondary)',
              }}
            >
              Figura siguiente <ChevronRight size={12} strokeWidth="var(--icon-stroke)" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EscenarioFigura;
