import React from 'react';
import { RotateCw, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { IconoLeyenda } from './IconosFiguras';
import { medidaDeFigura, type TipoFigura } from '../../lib/figuras';

export interface AISuggestionData {
  suggestedTitle: string;
  suggestedNote: string;
  /** Opcional: el endpoint de sugerencia devuelve solo el texto, y un número de
   *  confianza inventado sería un dato falso. Cuando no viene, no se pinta. */
  confidence?: number;
}

export interface LienzoEditorialActivoProps {
  figureNumber: number;
  figureTitle: string;
  figureNote?: string;
  imageUrl?: string;
  /** El tipo de activo. Decide el rótulo (Figura/Tabla) y qué cuerpo se pinta. */
  tipo?: TipoFigura;
  /** Datos de la tabla cuando `tipo` es `'table'`. */
  tabla?: { headers: string[]; rows: string[][] } | null;
  /** Tamaño DECLARADO en el `.docx`, para pintar la imagen a escala real. */
  anchoCm?: number | null;
  altoCm?: number | null;
  prevParagraph?: string;
  nextParagraph?: string;
  aiSuggestion?: AISuggestionData;
  onRotate?: () => void;
  onReplaceImage?: () => void;
  onApplyCaption?: (caption: { title: string; note: string }) => void;
}

export const LienzoEditorialActivo: React.FC<LienzoEditorialActivoProps> = ({
  figureNumber,
  figureTitle,
  figureNote,
  imageUrl,
  tipo = 'image',
  tabla,
  anchoCm,
  altoCm,
  prevParagraph,
  nextParagraph,
  aiSuggestion,
  onRotate,
  onReplaceImage,
  onApplyCaption,
}) => {
  const esTabla =
    tipo === 'table' &&
    Array.isArray(tabla?.headers) &&
    Array.isArray(tabla?.rows) &&
    (tabla!.headers.length > 0 || tabla!.rows.length > 0);
  const encabezados = esTabla ? tabla!.headers : [];
  const filas = esTabla ? tabla!.rows : [];
  const rotulo = tipo === 'table' ? 'Tabla' : tipo === 'equation' ? 'Ecuación' : 'Figura';
  const medida = medidaDeFigura({ width_cm: anchoCm ?? undefined, height_cm: altoCm ?? undefined });
  return (
    <div
      data-testid="editorial-reading-canvas"
      className="fig-taller fig-paper"
      style={{
        padding: 'var(--space-8)',
        margin: '0 auto',
        maxWidth: '820px',
        backgroundColor: 'var(--paper-white)',
        color: 'var(--paper-ink)',
        fontFamily: 'var(--font-sans)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Párrafo anterior: prosa del manuscrito, serif de papel */}
      {prevParagraph && (
        <p
          className="font-serif indent-8 text-justify mb-6"
          style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--paper-ink)' }}
        >
          {prevParagraph}
        </p>
      )}

      {/* Bloque APA 7 de Figura — sin tarjeta: jerarquía por tinta y hairlines */}
      <figure style={{ margin: '0 0 var(--space-6)' }}>
        {/* Rótulo: negrita, línea propia (APA 7) */}
        <div
          className="font-bold"
          style={{ fontSize: '14px', color: 'var(--paper-ink)', letterSpacing: '0.01em' }}
        >
          {rotulo} {figureNumber}
        </div>

        {/* Título: cursiva, línea separada (APA 7) */}
        <div
          className="italic"
          style={{ fontSize: '14px', color: 'var(--paper-ink)', margin: '2px 0 var(--space-3)' }}
        >
          {figureTitle}
        </div>

        {esTabla ? (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              color: 'var(--paper-ink)',
              marginBottom: 'var(--space-3)',
            }}
          >
            {encabezados.length > 0 && (
              <thead>
                <tr>
                  {encabezados.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px',
                        borderTop: '2px solid var(--paper-ink)',
                        borderBottom: '1px solid var(--paper-ink)',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {filas.map((fila, ri) => (
                <tr key={ri}>
                  {fila.map((celda, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '6px 10px',
                        borderBottom:
                          ri === filas.length - 1
                            ? '2px solid var(--paper-ink)'
                            : '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
        {/* Marco de imagen plano con controles flotantes */}
        <div
          style={{
            position: 'relative',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-bg-surface-alt)',
            minHeight: '220px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Figura ${figureNumber}`}
              className="fig-media-img"
              style={{
                width: medida.declarada ? `${medida.anchoPx}px` : undefined,
                maxHeight: medida.declarada ? undefined : '380px',
                height: medida.declarada ? `${medida.altoPx}px` : 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
              }}
            />
          ) : (
            <div
              style={{
                padding: 'var(--space-10) var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-text-tertiary)',
                fontSize: '12px',
              }}
            >
              <IconoLeyenda size={28} color="var(--color-text-tertiary)" />
              <span>Sin vista previa</span>
            </div>
          )}

          {(onRotate || onReplaceImage) && (
            <div
              style={{
                position: 'absolute',
                top: 'var(--space-2)',
                right: 'var(--space-2)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {onRotate && (
                <button
                  type="button"
                  onClick={onRotate}
                  title="Rotar 90°"
                  aria-label="Rotar imagen"
                  className="fig-media-btn"
                >
                  <RotateCw size={15} />
                </button>
              )}
              {onReplaceImage && (
                <button
                  type="button"
                  onClick={onReplaceImage}
                  title="Reemplazar archivo"
                  aria-label="Reemplazar imagen"
                  className="fig-media-btn"
                >
                  <ImageIcon size={15} />
                </button>
              )}
            </div>
          )}
        </div>
          </>
        )}

        {/* Nota de la figura */}
        {figureNote && (
          <figcaption
            style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--space-2)',
            }}
          >
            {figureNote}
          </figcaption>
        )}
      </figure>

      {/* Sugerencia IA — banda plana, no tarjeta anidada */}
      {aiSuggestion && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
            >
              <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
              <span>Sugerencia editorial de leyenda (IA)</span>
              {typeof aiSuggestion.confidence === 'number' && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--color-text-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(aiSuggestion.confidence * 100)}%
                </span>
              )}
            </div>
            {onApplyCaption && (
              <button
                type="button"
                onClick={() =>
                  onApplyCaption({
                    title: aiSuggestion.suggestedTitle,
                    note: aiSuggestion.suggestedNote,
                  })
                }
                className="fig-apply-btn"
                aria-label="Aplicar sugerencia"
              >
                <Check size={13} />
                <span>Aplicar sugerencia</span>
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-1)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ margin: 0 }}>
              <span className="fig-kicker">Título sugerido</span>{' '}
              <span className="italic">{aiSuggestion.suggestedTitle}</span>
            </p>
            {aiSuggestion.suggestedNote && (
              <p style={{ margin: 0 }}>
                <span className="fig-kicker">Nota sugerida</span>{' '}
                {aiSuggestion.suggestedNote}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Párrafo posterior */}
      {nextParagraph && (
        <p
          className="font-serif indent-8 text-justify mt-6"
          style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--paper-ink)' }}
        >
          {nextParagraph}
        </p>
      )}
    </div>
  );
};
