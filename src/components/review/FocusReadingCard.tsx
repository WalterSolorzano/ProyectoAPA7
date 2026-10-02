/* WordAPA7 — review: la tarjeta de lectura.
   El centro de la vista. Un párrafo, el encabezado de sección y página, y
   los resaltados inline. El cuerpo se auto-ajusta entre 13 y 19px; si
   ningún tamaño cabe, la tarjeta scrollea (piso duro en useAutoFitText).

   El origen de marcas NO se arma acá: es `useMarkSource`, el mismo que usa el
   lienzo. Esta tarjeta no decide qué se subraya ni si las citas están prendidas
   —eso es de los dos canales juntos— porque decidirlo dos veces es como un
   defecto llega a la pantalla por un solo lado. */

import React, { useMemo } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useAutoFitText } from '../../hooks/useAutoFitText';
import { useMarkSourceBase, buildMarkSource } from '../../hooks/useMarkSource';
import { ReadingText } from './ReadingText';
import { ENGINE_META, type AuditItem } from '../../hooks/useReviewWorkbench';
import { EditorialMascot, type MascotExpression, type MascotKind } from '../layout/EditorialMascot';

export interface FocusReadingCardProps {
  item: AuditItem | null;
  totalFindings: number;
}

export function FocusReadingCard({ item, totalFindings }: FocusReadingCardProps) {
  const doc = useDocStore((s) => s.doc);
  const markBase = useMarkSourceBase();

  const { containerRef, fontSize, lineHeight } = useAutoFitText(item?.id);

  const elem = useMemo(
    () => (item?.element_id ? doc?.elements.find((e) => e.id === item.element_id) : undefined),
    [doc, item?.element_id],
  );

  const source = useMemo(() => buildMarkSource(markBase, elem), [markBase, elem]);

  const pagina = item
    ? item.pageNumber
      ? `Página ${item.pageNumber} de la revisión`
      : 'Sin página asignada'
    : null;
  const seccion = item ? `${ENGINE_META[item.category]?.title ?? item.category} · ` : '';

  const texto = item?.originalText?.trim() ? item.originalText : null;

  const mascotKind: MascotKind =
    item?.category === 'spelling'
      ? 'strike'
      : item?.category === 'structure'
        ? 'ruler'
        : item?.category === 'citations'
          ? 'reference'
          : 'highlighter';

  const mascotExpression: MascotExpression =
    totalFindings === 0
      ? 'happy'
      : totalFindings > 3
        ? 'worried'
        : item?.category === 'ai'
          ? 'curious'
          : 'neutral';

  return (
    <section
      aria-label="Párrafo en revisión"
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <EditorialMascot size={24} kind={mascotKind} expression={mascotExpression} />
          {pagina !== null && <span style={{ fontWeight: 600 }}>{`${seccion}${pagina}`}</span>}
        </div>
        <span>{totalFindings} {totalFindings === 1 ? 'hallazgo en este bloque' : 'hallazgos en este bloque'}</span>
      </header>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          // Contenedor de scroll ACOTADO, no `overflow: hidden` sin tope: el
          // auto-ajuste decide "cabe sin scroll interno" comparando
          // scrollHeight contra clientHeight, y sin altura acotada esa
          // comparación se cumple siempre y el ajuste no significa nada.
          overflowY: 'auto',
          padding: '0 var(--space-10) var(--space-8)',
          fontFamily: 'var(--font-family)',
          fontSize: `${fontSize}px`,
          lineHeight,
          color: 'var(--color-text-primary)',
        }}
      >
        {texto !== null ? (
          <ReadingText text={texto} source={source} />
        ) : (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            {item
              ? 'El texto de este hallazgo ya no está en el documento.'
              /* Decía "elige uno en el panel de la derecha". El rack está a la
                 derecha en ventana ancha, pero en angosta no hay rack: un texto
                 que nombra una posición que puede no existir es un texto que
                 miente, y aquí miente sobre lo que el usuario tiene delante. Se
                 dice la ACCIÓN, que existe en los dos anchos. */
              : 'Sin hallazgo seleccionado. Pulsa “Siguiente hallazgo” para recorrer los hallazgos de a uno.'}
          </p>
        )}
      </div>
    </section>
  );
}
