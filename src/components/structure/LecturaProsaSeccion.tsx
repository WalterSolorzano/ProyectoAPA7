/* WordAPA7 — Lectura Editorial de Prosa por Sección
 *
 * Muestra únicamente los párrafos e imágenes pertenecientes al capítulo o
 * subsección activa, con maquetación de libro académico de alta legibilidad.
 * Cero emojis: únicamente íconos de lucide-react y tokens CSS puros.
 */

import React, { useMemo } from 'react';
import { BookOpen, FileText, Image as ImageIcon } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';
import type { ElementModel } from '../../types';

export interface LecturaProsaSeccionProps {
  seccionActiva: NodoJerarquia | null;
  elementos: readonly ElementModel[];
}

export const LecturaProsaSeccion: React.FC<LecturaProsaSeccionProps> = ({
  seccionActiva,
  elementos,
}) => {
  // Extraer los elementos pertenecientes a la sección activa
  const elementosSeccion = useMemo(() => {
    if (!seccionActiva) return [];

    const idInicio = seccionActiva.elementoId || seccionActiva.id;
    const idxInicio = elementos.findIndex(
      (e) => e.id === idInicio || (e.type === 'heading' && e.text.trim() === seccionActiva.titulo.trim())
    );

    if (idxInicio === -1) return [];

    const resultado: ElementModel[] = [];
    resultado.push(elementos[idxInicio]);

    const nivelActual = seccionActiva.nivel || 1;

    for (let i = idxInicio + 1; i < elementos.length; i++) {
      const el = elementos[i];
      if (el.type === 'heading') {
        const nivelEl = el.heading_level || 1;
        // Si encontramos otro encabezado del mismo nivel o superior, termina la sección
        if (nivelEl <= nivelActual) {
          break;
        }
      }
      resultado.push(el);
    }

    return resultado;
  }, [seccionActiva, elementos]);

  if (!seccionActiva) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[var(--text-muted,#64748b)]">
        <BookOpen className="w-10 h-10 stroke-1 mb-3 text-[var(--text-muted,#94a3b8)]" />
        <p className="text-sm font-medium">Selecciona un capítulo o sección</p>
        <p className="text-xs text-[var(--text-muted,#94a3b8)] mt-1">
          Haz clic en cualquier nodo del diagrama o del esqueleto de navegación para leer su prosa.
        </p>
      </div>
    );
  }

  // Verificar si hay contenido aparte del encabezado principal
  const contenidoProsa = elementosSeccion.slice(1);
  const tieneContenido = contenidoProsa.some(
    (el) => (el.type === 'paragraph' && el.text?.trim()) || el.type === 'image' || el.type === 'heading'
  );

  return (
    <div className="h-full overflow-y-auto p-6 flex justify-center bg-[var(--canvas-bg,#f8fafc)]">
      <article
        data-testid="hoja-editorial"
        className="w-full max-w-2xl bg-[var(--paper-white,#ffffff)] text-[var(--paper-ink,#111827)] rounded-lg shadow-sm border border-[var(--border-subtle,#e2e8f0)] p-8 sm:p-12 font-serif leading-relaxed"
      >
        {/* Cabecera del Capítulo */}
        <header className="mb-8 pb-4 border-b border-[var(--border-subtle,#e2e8f0)]">
          <div className="flex items-center gap-2 mb-2 font-sans">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-bg-surface-alt,#f1f5f9)] text-[var(--text-muted,#64748b)] border border-[var(--border-subtle,#e2e8f0)]">
              Nivel H{seccionActiva.nivel}
            </span>
            {seccionActiva.fase && (
              <span className="text-[10px] font-sans text-[var(--text-muted,#64748b)] uppercase tracking-wider">
                Fase: {seccionActiva.fase}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-[var(--text-main,#0f172a)]">
            {seccionActiva.titulo}
          </h1>
        </header>

        {/* Cuerpo Editorial */}
        {!tieneContenido ? (
          <div className="py-12 px-4 text-center rounded border border-dashed border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface-alt,#f8fafc)] font-sans">
            <FileText className="w-8 h-8 stroke-1 mx-auto mb-2 text-[var(--text-muted,#94a3b8)]" />
            <p className="text-sm font-medium text-[var(--text-muted,#64748b)]">
              Esta sección aún no contiene párrafos de prosa
            </p>
            <p className="text-xs text-[var(--text-muted,#94a3b8)] mt-1">
              Los párrafos y activos redactados en Word bajo este título se visualizarán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-[15px] text-[var(--paper-ink,#111827)]">
            {contenidoProsa.map((el) => {
              if (el.type === 'heading') {
                const nivel = el.heading_level || 2;
                return (
                  <h2
                    key={el.id}
                    className={`font-sans font-bold text-[var(--text-main,#0f172a)] pt-4 pb-1 ${
                      nivel === 2 ? 'text-lg' : 'text-base'
                    }`}
                  >
                    {el.text}
                  </h2>
                );
              }

              if (el.type === 'image') {
                return (
                  <figure
                    key={el.id}
                    className="my-6 p-4 rounded border border-[var(--border-subtle,#e2e8f0)] bg-[var(--color-bg-surface-alt,#f8fafc)] text-center font-sans"
                  >
                    <div className="flex items-center justify-center p-6 bg-[var(--paper-white,#ffffff)] rounded border border-[var(--border-subtle,#e2e8f0)] mb-3">
                      <ImageIcon className="w-10 h-10 text-[var(--accent-primary,#0284c7)] stroke-1" />
                    </div>
                    {el.image_info && (
                      <figcaption className="text-xs text-[var(--text-muted,#64748b)]">
                        <span className="font-semibold text-[var(--text-main,#0f172a)]">
                          Figura {el.image_info.figure_number}.
                        </span>{' '}
                        {el.image_info.caption || 'Sin leyenda asignada'}
                      </figcaption>
                    )}
                  </figure>
                );
              }

              return (
                <p key={el.id} className="text-justify indent-6">
                  {el.text}
                </p>
              );
            })}
          </div>
        )}
      </article>
    </div>
  );
};
