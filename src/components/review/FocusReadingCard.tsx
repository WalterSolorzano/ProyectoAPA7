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

export interface FocusReadingCardProps {
  item: AuditItem | null;
  totalFindings: number;
}

export function FocusReadingCard({ item, totalFindings }: FocusReadingCardProps) {
  const doc = useDocStore((s) => s.doc);
  const markBase = useMarkSourceBase();

  /* La clave del contenido es el id del hallazgo, NO el texto: el alto de la
     caja no cambia al pasar de un párrafo al siguiente, así que el
     ResizeObserver no dispara por eso. Sin esta clave, que es opcional, el
     párrafo nuevo heredaría el cuerpo del anterior y ni el compilador ni un
     test se enterarían. `undefined` es lo que el parámetro opcional acepta (el
     hook compara por identidad en el array de dependencias, donde `undefined`
     y `null` se comportan igual). */
  const { containerRef, fontSize, lineHeight } = useAutoFitText(item?.id);

  /* El elemento que se está leyendo. Sin él, `ReadingText` no puede evaluar
     los motores que se anclan en el elemento (corrector, comentario, citas) y
     la tarjeta llegaría al usuario sin ninguno de sus resaltados: el párrafo
     es el MISMO que pinta el lienzo, y los dos canales tienen que decir lo
     mismo. Un hallazgo sin elemento (una referencia huérfana, por ejemplo)
     sigue mostrándose: lo que no hay, no se inventa. */
  const elem = useMemo(
    () => (item?.element_id ? doc?.elements.find((e) => e.id === item.element_id) : undefined),
    [doc, item?.element_id],
  );

  const source = useMemo(() => buildMarkSource(markBase, elem), [markBase, elem]);

  /* `null` es "no hay página", no "la página 0": un elemento fuera del índice
     no tiene página y la tarjeta no estima una. El 0 tampoco es una página,
     así que cae en el mismo rótulo. */
  const pagina = !item
    ? 'Sin selección'
    : item.pageNumber
      ? `Página ${item.pageNumber} de la revisión`
      : 'Sin página asignada';
  const seccion = item ? `${ENGINE_META[item.category]?.title ?? item.category} · ` : '';

  /* Un hallazgo puede quedarse sin texto: el elemento se editó o se borró
     después de que el motor lo midiera. Un párrafo vacío no dice nada, así que
     se dice en palabras qué pasó. */
  const texto = item?.originalText?.trim() ? item.originalText : null;

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
          padding: 'var(--space-3) var(--space-10)',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <span>{`${seccion}${pagina}`}</span>
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
              : 'Sin hallazgo seleccionado. Elige uno en el panel de la derecha o pulsa “Siguiente hallazgo”.'}
          </p>
        )}
      </div>
    </section>
  );
}
