/* WordAPA7 — review: el workbench, una sola superficie secuencial.
   Un hallazgo a la vez: la tira de arriba y la tarjeta de lectura. Sin minimapa
   ni rack de motores: la lectura secuencial es la decisión de diseño
   (AGENTS.md §1), no un descuido, y por eso el grid es de UNA columna.

   Lo que esta vista hace y lo que NO hace:

   - NO decide qué acción tiene un motor ni cómo se ejecuta. La lógica de
     acciones vive en `useReviewActions`; esta vista pinta la lectura y navega.
   - NO re-deriva `hasFindings` ni los grupos: los usa como vienen. `groups` es
     el resumen FILTRADO (el estado vacío lo quiere estrecho) y `allGroups` el
     completo (los chips lo necesitan entero).
   - NO escribe las reglas del filtro: consume `visibleCount` del hook para no
     dejar "Siguiente hallazgo" encendido sin destino.
   - Las páginas salen de `usePageIndex` para las cosas que las nombran (la
     cuenta de la tira y la etiqueta de la tarjeta). */

import React, { useEffect, useMemo, useRef } from 'react';
import { useReviewWorkbench, accionDeItem, type EngineFilter } from '../../hooks/useReviewWorkbench';
import { PaperCanvas } from '../layout/PaperCanvas';
import { ReviewStrip } from './ReviewStrip';
import { FocusReadingCard } from './FocusReadingCard';
import { AiHierarchy } from './AiHierarchy';
import { EstadoVacio } from '../shared/EstadoVacio';
import { useDocStore } from '../../store/useDocStore';
import { ScanLine } from 'lucide-react';

export interface ReviewWorkbenchProps {
  /** Volver a la puerta de Revisión. Sin esto, el control no se pinta. */
  onExit?: () => void;
  /** Fase con la que abre la revisión (drill-down desde la puerta). `null` o
   *  ausente = sin filtro de fase. Se aplica UNA sola vez, al montar: si el
   *  usuario cambia el filtro después, su elección manda. */
  initialPhase?: string | null;
  /** Motor con el que abre la revisión. Misma regla de una sola vez. */
  initialEngine?: EngineFilter | null;
}

export function ReviewWorkbench({ onExit, initialPhase, initialEngine }: ReviewWorkbenchProps) {
  const wb = useReviewWorkbench();
  const doc = useDocStore((s) => s.doc);
  /* El interruptor que descarta los hallazgos sin decir nada. La vista lo lee
     para NOMBRARLO cuando la pantalla queda vacía: apagado, los motores corren,
     sus resultados se tiran, y sin esta lectura el motivo sería "no corrió
     ningún motor", que es exactamente lo contrario de lo que pasó. */
  const sugerenciasProactivas = useDocStore((s) => s.sugerenciasProactivas);

  /* El foco elegido en la puerta se aplica UNA vez, al montar. El hook reinicia
     el filtro de fase por sesión de documento, así que este efecto corre
     DESPUÉS del suyo y el foco gana en el arranque; a partir de ahí el usuario
     manda: un `useEffect` que re-aplicara el foco en cada render le pisaría el
     filtro que acaba de elegir. */
  const focoAplicado = useRef(false);
  useEffect(() => {
    if (focoAplicado.current) return;
    focoAplicado.current = true;
    if (initialPhase) wb.setPhaseFilter(initialPhase);
    if (initialEngine) wb.setFilter(initialEngine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* La fase activa, como línea de contexto de la superficie secuencial. El
     `label` sale de `allPhases` (el mismo que pinta el chip): la tarjeta no
     re-deriva el nombre de una fase. Sin fase activa, la línea no existe. */
  const faseActiva =
    wb.phaseFilter === 'all'
      ? null
      : wb.allPhases.find((f) => f.key === wb.phaseFilter)?.label ?? null;

  /* El "Escanear" del estado vacío es el MISMO verbo que el de la tira, con el
     mismo guardián de rechazo: el hook ya publica el resultado de cada motor
     con su propio aviso, así que lo único que no debe quedar es una promesa sin
     manejar en la consola. */
  const escanear = () => {
    Promise.resolve(wb.scanAll()).catch(() => undefined);
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

  /* La acción del hallazgo SELECCIONADO y el grupo del que sale. La tarjeta no
     re-deriva qué botón existe: lee `accionDeItem` (la misma tabla que agrupa
     los subtipos) y el grupo lo aporta `allGroups`. "Aceptar todas" actúa sobre
     el subtipo, que es el alcance que el propio hook declara en su `action`. */
  const sel = wb.selected;
  const selAction = sel ? accionDeItem(sel) : undefined;
  const selEngineGroup = sel ? wb.allGroups.find((g) => g.engine === sel.category) : undefined;
  const selSubtype = sel && selEngineGroup
    ? selEngineGroup.groups.find((g) => g.key === `${sel.category}:${sel.subtype}`)
    : undefined;
  const bulkCount = selSubtype ? selSubtype.items.length : 0;

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
        phaseFilter={wb.phaseFilter}
        onPhaseFilter={wb.setPhaseFilter}
        phases={wb.allPhases}
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
        onExit={onExit}
      />

      {/* La pista de la grilla va ACOTADA (`minmax(0, 1fr)`) a propósito: la
          tarjeta de lectura decide el cuerpo de su párrafo comparando
          `scrollHeight` contra `clientHeight` de un hijo con `flex: 1` y
          `minHeight: 0`, y las dos cosas son inertes sin un padre de alto
          definido. Sin esta pista, el auto-ajuste mediría contra una caja que
          crece con el texto y "cabe" sería siempre cierto.

          UNA sola columna: la revisión es un hallazgo a la vez (AGENTS.md §1). */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'minmax(0, 1fr)',
          gap: 'var(--space-5)',
          padding: 'var(--space-5) var(--space-6)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {wb.viewMode === 'ia' ? (
          <AiHierarchy
            elements={doc?.elements ?? null}
            items={wb.items}
            activa={wb.phaseFilter}
            onSelectPhase={(key) => {
              wb.setPhaseFilter(key);
            }}
            onOpenInWorkbench={(item) => {
              wb.elegirHallazgo(item.id);
              wb.setViewMode('focus');
            }}
            onApplyParaphrase={async (item, newText) => {
              if (item.element_id && doc) {
                await useDocStore.getState().updateElementText(item.element_id, newText);
                wb.dismiss(item);
              }
            }}
            onMark={wb.markForReview}
            onDismiss={wb.dismiss}
            markedIds={wb.markedIds}
            busy={wb.isApplying}
          />
        ) : wb.viewMode === 'canvas' ? (
          <div style={{ minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* El lavado de acento es "qué bloques tienen hallazgos": sin él, el
               modo Hoja pierde la única señal de dónde mirar, que es justo lo
               que el modo Hoja existe para ver. El conjunto lo publica el hook
               porque el filtro también lo recorta —el mismo conjunto que cuenta
               `visibleCount`—, y derivarlo acá volvería a duplicar su
               predicado. */}
            <PaperCanvas reviewHighlightIds={wb.highlightIds} />
          </div>
        ) : doc ? (
          /* El estado vacío vive AQUÍ, en la grilla principal. La grilla se
             renderiza siempre, así que el mensaje no depende de un panel que se
             pueda retirar. */
          wb.groups.length === 0 ? (
            <EstadoVacio
              /* El motivo NO es un único campo: es una decisión, y su orden es el
                 orden de urgencia. Si hay hallazgos, el culpable es el filtro; si
                 no hay, primero se pregunta si algo está corriendo y después si
                 el interruptor está apagado. Y hay una razón para ese orden que
                 no es estética: apagado el interruptor, los motores que corren
                 igual dejarían la pantalla vacía, así que "corriendo" sería
                 cierto y el mensaje siguiente sería el mismo. La diferencia es
                 que el de "corriendo" desaparece solo, y el otro hay que
                 arreglarlo a mano.

                 Y el botón dice SIEMPRE "Escanear", nunca "corriendo": el
                 estado ya lo dice el título, y un botón que repite el estado
                 hace que el texto de la pantalla no sirva para afirmar cuál de
                 los dos motivos está —que es lo que se necesita comprobar—. */
              motivo={
                wb.hasFindings
                  ? 'sin-resultados'
                  : wb.isAuditing
                    ? 'corriendo'
                    : !sugerenciasProactivas
                      ? 'sugerencias-apagadas'
                      : 'sin-motor'
              }
              /* El filtro se NOMBRA: "el filtro" a secas deja al usuario
                 adivinando cuál de los cinco hay que sacar, y lo único que la
                 pantalla vacía le ofrece al usuario es eso. */
              filtroActivo={wb.hasFindings ? wb.filterLabel : null}
              /* Y lo que corre se nombra, porque un "cargando" sin decir qué
                 carga no le dice a nadie cuándo va a terminar. */
              motoresCorriendo={wb.motoresAuditando}
              /* La acción DE VERDAD, no un texto que manda a otro lado: el
                 botón de "Escanear" vive en la tira de arriba, y un estado
                 vacío que dice "pulsa Escanear" mientras el que puede pulsar
                 está a 44px de la grilla es un texto que hace trabajar al
                 usuario de más. Es el mismo verbo con el mismo `scanAll`, así
                 que no hay dos escaneos: hay uno. */
              accion={
                <button
                  type="button"
                  onClick={escanear}
                  disabled={wb.isScanning || wb.isAuditing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-accent-soft)',
                    color: 'var(--color-accent)',
                    fontFamily: 'inherit',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <ScanLine size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
                  Escanear
                </button>
              }
            />
          ) : (
            <FocusReadingCard
              key={wb.selected?.id ?? 'sin-hallazgo'}
              item={wb.selected}
              phaseLabel={faseActiva}
              totalFindings={enElBloque}
              action={selAction}
              marked={sel ? wb.markedIds.includes(sel.id) : false}
              busy={wb.isApplying}
              bulkCount={bulkCount}
              onAccept={(it) => {
                void wb.acceptOne(it);
              }}
              onAcceptAll={
                selSubtype
                  ? () => {
                      void wb.runGroupAction(selSubtype);
                    }
                  : undefined
              }
              onMark={(it) => wb.markForReview(it)}
              onDismiss={(it) => wb.dismiss(it)}
              onEngineAction={
                selEngineGroup
                  ? () => {
                      void wb.runGroupAction(selEngineGroup);
                    }
                  : undefined
              }
            />
          )
        ) : (
          /* Sin documento no hay elemento que resolver, y una tarjeta con el
             párrafo limpio y sin una sola marca es indistinguible de "el motor
             no encontró nada". El hueco se dice. */
          <EstadoVacio motivo="sin-documento" />
        )}
      </div>
    </div>
  );
}

export default ReviewWorkbench;
