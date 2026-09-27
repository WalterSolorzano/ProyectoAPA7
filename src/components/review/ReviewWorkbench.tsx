/* WordAPA7 — review: el workbench.
   Tres columnas: minimapa de páginas, tarjeta de lectura y rack de hallazgos
   agrupados por motor. La tira de arriba es la única barra. El grid retira el
   rack en ventana estrecha para que el centro siga siendo legible.

   Lo que esta vista hace y lo que NO hace:

   - NO decide qué acción tiene un motor ni cómo se ejecuta. Pinta el rótulo
     que trae el grupo y se lo devuelve a `runGroupAction`. Re-derivar eso acá
     fue exactamente el bug que un `EngineGroup` con un subtipo 'mark' entre
     subtipos 'accept' producía: un "Aceptar todas" que escribía prosa
     generada en el documento de la persona.
   - NO re-deriva `hasFindings` ni los grupos: los usa como vienen. `groups` es
     el resumen FILTRADO (el rack y la semilla de apertura lo quieren estrecho)
     y `allGroups` el completo (los chips lo necesitan entero).
   - SÍ dice lo que los números no dicen solos: hasta dónde llega una acción en
     masa, y por qué un botón encendido no hace nada.
   - Las páginas salen de `usePageIndex` para las TRES cosas que las nombran
     (la cuenta de la tira, las marcas del minimapa y la etiqueta del
     bloque). Esas páginas base no son las del lienzo medido —una limitación
     medida y documentada de `usePageIndex`—, así que el número lleva un
     `title` que lo dice, en vez de aparecer al lado de un minimapa con el que
     parece discrepar. */

import React, { useEffect, useMemo, useState } from 'react';
import {
  useReviewWorkbench,
  type AuditItem,
  type EngineGroup,
  type SubtypeGroup,
} from '../../hooks/useReviewWorkbench';
import { ReviewMinimap } from '../wizard/ReviewMinimap';
import { PaperCanvas } from '../layout/PaperCanvas';
import { ReviewStrip } from './ReviewStrip';
import { FocusReadingCard } from './FocusReadingCard';
import { EngineGroupCard, SubtypeRow } from './EngineGroupCard';
import { FindingDetail } from './FindingDetail';
import { useDocStore } from '../../store/useDocStore';

/** Por debajo de este ancho, el rack de 400px deja el centro inservible. */
const RACK_BREAKPOINT = 1180;
const RACK_WIDTH = 400;
const MINIMAP_WIDTH = 19;

const alternar = <T,>(lista: T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];

/**
 * La REDACCIÓN del aviso de alcance. Lo que llega ya está contado: `covered` y
 * `count` los publica el hook, que es quien aplica la regla de "la cabecera
 * actúa solo sobre los subtipos que comparten su acción". Acá solo se traduce a
 * palabras — y el hook no lo dice porque la redacción es de la vista.
 */
function coberturaDeMotor(group: EngineGroup): string | undefined {
  if (!group.massLabel) return undefined;
  if (group.covered === 0) {
    return 'Este motor no tiene nada que aplicar en bloque: revisa sus hallazgos uno por uno.';
  }
  if (group.covered < group.count) {
    return `${group.count - group.covered} de ${group.count} hallazgos de este motor no tienen corrección automática.`;
  }
  return undefined;
}

export function ReviewWorkbench() {
  const wb = useReviewWorkbench();
  const doc = useDocStore((s) => s.doc);
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setAncho(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const rackVisible = ancho >= RACK_BREAKPOINT;

  /* `nextFinding` recorre lo que el FILTRO deja ver, y `hasFindings` cuenta el
     documento entero: con un filtro que ya no tiene hallazgos propios, el
     botón quedaría encendido y sin destino. La cuenta la publica el hook
     (`visibleCount`) porque el predicado del filtro es suyo: repetirlo acá
     sería la misma regla en dos archivos, y es exactamente el modo de fallo
     que esta comprobación evita. */

  /* El motor y la acción los DECLARA el grupo. La vista pinta y ejecuta; no
     resuelve. El `catch` no informa: el hook ya publica el resultado de cada
     mecanismo con su propio toast, y lo que no debe quedar es un rechazo sin
     manejar en la consola de la persona. */
  const correrAccion = (grupo: EngineGroup | SubtypeGroup) => {
    Promise.resolve(wb.runGroupAction(grupo)).catch(() => undefined);
  };

  /* Desplazarse entre apariciones del MISMO subtipo, con envoltura: el delta
     lo manda el detalle, y el destino es el hallazgo, no el índice. */
  const pasoEn = (items: AuditItem[], i: number) => (delta: number) => {
    if (!items.length) return;
    wb.select(items[(i + delta + items.length) % items.length].id);
  };

  /* "N hallazgos en este bloque": los que caen en el MISMO elemento. Un
     hallazgo sin elemento (una referencia huérfana vive en la bibliografía)
     no comparte bloque con nadie, y contarlo contra `element_id === ''` sumaría
     todas las huérfanas del documento. */
  const enElBloque = useMemo(() => {
    const sel = wb.selected;
    if (!sel) return 0;
    if (!sel.element_id) return 1;
    return wb.items.filter((i) => i.element_id === sel.element_id).length;
  }, [wb.selected, wb.items]);

  const columnas = rackVisible
    ? `${MINIMAP_WIDTH}px minmax(0, 1fr) ${RACK_WIDTH}px`
    : `${MINIMAP_WIDTH}px minmax(0, 1fr)`;

  return (
    <div
      style={{
        flex: 1,
        /* El alto tiene que ser EXPLÍCITO, y no por gusto: el padre de esta
           vista (`App.tsx`) es una caja de bloque, así que `flex: 1` no estira
           nada y el alto de la raíz saldría del contenido. Con un alto
           indefinido, la pista `minmax(0, 1fr)` de abajo resuelve contra
           max-content, las dos cajas que se desplazan crecen con su contenido
           (y no desplazan nunca), y el padre las recorta sin que haya a dónde
           llegar. Lo que se caía sin esto era el AUTO-AJUSTE: `cabe()`
           compara `scrollHeight` contra `clientHeight` de una caja que jamás
           desborda, así que "cabe" siempre y el tope de 26 líneas nunca llega a
           morder. Todos los pasos hermanos lo declaran (`Step2HeadingsWizard`,
           `Step3FiguresTablesWizard`); esta vista es el único lugar donde faltaba. */
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        backgroundColor: 'var(--color-bg-canvas)',
      }}
    >
      <ReviewStrip
        engineGroups={wb.allGroups}
        filter={wb.filter}
        onFilter={wb.setFilter}
        total={wb.metrics.total}
        totalPages={wb.totalPages}
        currentPage={wb.currentPage}
        onPage={wb.goToPage}
        onNextFinding={wb.nextFinding}
        canNextFinding={wb.visibleCount > 0}
        compliance={wb.metrics.compliance}
        viewMode={wb.viewMode}
        onViewMode={wb.setViewMode}
        hasFindings={wb.hasFindings}
        onScan={wb.scanAll}
        isScanning={wb.isScanning}
      />

      {/* La pista de la grilla va ACOTADA (`minmax(0, 1fr)`) a propósito: la
          tarjeta de lectura decide el cuerpo de su párrafo comparando
          `scrollHeight` contra `clientHeight` de un hijo con `flex: 1` y
          `minHeight: 0`, y las dos cosas son inertes sin un padre de alto
          definido. Sin esta pista, el auto-ajuste mediría contra una caja que
          crece con el texto y "cabe" sería siempre cierto. */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: columnas,
          gridTemplateRows: 'minmax(0, 1fr)',
          gap: 'var(--space-5)',
          padding: 'var(--space-5) var(--space-6)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <ReviewMinimap
          totalPages={wb.totalPages}
          marks={wb.marks}
          currentPage={wb.currentPage}
          onPageClick={wb.goToPage}
        />

        {wb.viewMode === 'canvas' ? (
          <div style={{ minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            /* El lavado de acento es "qué bloques tienen hallazgos": sin él, el
               modo Hoja pierde la única señal de dónde mirar, que es justo lo
               que el modo Hoja existe para ver. El conjunto lo publica el hook
               porque el filtro también lo recorta —el mismo conjunto que cuenta
               `visibleCount`—, y derivarlo acá volvería a duplicar su
               predicado. */
            <PaperCanvas reviewHighlightIds={wb.highlightIds} />
          </div>
        ) : doc ? (
          <FocusReadingCard item={wb.selected} totalFindings={enElBloque} />
        ) : (
          /* Sin documento no hay elemento que resolver, y una tarjeta con el
             párrafo limpio y sin una sola marca es indistinguible de "el motor
             no encontró nada". El hueco se dice. */
          <p
            role="status"
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6)',
              textAlign: 'center',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            No hay ningún documento abierto. Carga o crea un documento para empezar a revisar.
          </p>
        )}

        {rackVisible && (
          <aside
            aria-label="Hallazgos por motor"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {wb.groups.map((group) => (
              <EngineGroupCard
                key={group.engine}
                group={group}
                open={wb.openEngines.includes(group.engine)}
                onToggle={() => wb.setOpenEngines((prev) => alternar(prev, group.engine))}
                onMassAction={correrAccion}
                massNote={coberturaDeMotor(group)}
                busy={wb.isApplying}
              >
                {group.groups.map((sub) => (
                  <SubtypeRow
                    key={sub.key}
                    group={sub}
                    open={wb.openSubtypes.includes(sub.key)}
                    onToggle={() => wb.setOpenSubtypes((prev) => alternar(prev, sub.key))}
                    onMassAction={correrAccion}
                    busy={wb.isApplying}
                  >
                    {sub.items.map((it, i) => (
                      <FindingDetail
                        key={it.id}
                        item={it}
                        /* El estado de "marcado para revisar" se PINTA. Sin
                           esto, la única acción del motor probabilístico —la
                           que AGENTS.md §1 le concede y no le concede ninguna
                           más— no dejaba rastro: se aprieta, sale un toast y el
                           botón queda igual, así que se vuelve a apretar. */
                        marked={wb.markedIds.includes(it.id)}
                        /* La acción la DECLARA el subtipo, no el texto que
                           traiga el hallazgo: estructura trae `suggestedText`
                           (una leyenda genérica) y su mecanismo es rotular, no
                           pegar ese texto en el elemento. */
                        action={sub.action}
                        index={i}
                        total={sub.items.length}
                        onStep={pasoEn(sub.items, i)}
                        onAccept={wb.acceptOne}
                        onMark={wb.markForReview}
                        onDismiss={wb.dismiss}
                        onEngineAction={() => correrAccion(sub)}
                        /* El cerrojo de la acción en masa, no un `false`
                           constante. `acceptMany` recorre los hallazgos de uno en
                           uno con una llamada de red cada uno: sin esto, apretar
                           "Aceptar todas" dos veces dispara las MISMAS llamadas
                           sobre los MISMOS elementos y el documento queda con
                           una de las dos correcciones, elegida por quién
                           escribió último. */
                        busy={wb.isApplying}
                      />
                    ))}
                  </SubtypeRow>
                ))}
              </EngineGroupCard>
            ))}

            {wb.groups.length === 0 && (
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                {!doc
                  ? 'Carga un documento para empezar.'
                  : wb.hasFindings
                    ? /* El filtro dejó al rack sin filas, no el documento sin
                         hallazgos: decirlo al revés haría creer que el motor
                         no corrió. */
                      'Ningún hallazgo de este motor pasa el filtro. Vuelve a "Todo" para ver todos.'
                    : 'Ningún motor reportó hallazgos todavía. Pulsa "Escanear" para correr la revisión completa.'}
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export default ReviewWorkbench;
