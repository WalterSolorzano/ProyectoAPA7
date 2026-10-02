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
import { ReviewMinimap, MINIMAP_WIDTH, MINIMAP_ANCHO_MINIMO } from './ReviewMinimap';
import { PaperCanvas } from '../layout/PaperCanvas';
import { ReviewStrip } from './ReviewStrip';
import { FocusReadingCard } from './FocusReadingCard';
import { EngineGroupCard, SubtypeRow } from './EngineGroupCard';
import { FindingDetail } from './FindingDetail';
import { AiMosaic } from './AiMosaic';
import { AiHierarchy } from './AiHierarchy';
import { EstadoVacio } from '../shared/EstadoVacio';
import { useDocStore } from '../../store/useDocStore';
import { ScanLine } from 'lucide-react';

/** Por debajo de este ancho, el rack de 400px deja el centro inservible. */
const RACK_BREAKPOINT = 1180;
const RACK_WIDTH = 400;

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
  /* El interruptor que descarta los hallazgos sin decir nada. La vista lo lee
     para NOMBRARLO cuando la pantalla queda vacía: apagado, los motores corren,
     sus resultados se tiran, y sin esta lectura el motivo sería "no corrió
     ningún motor", que es exactamente lo contrario de lo que pasó. */
  const sugerenciasProactivas = useDocStore((s) => s.sugerenciasProactivas);
  /* La calibración de la rampa la escribe la pestaña Revisión de Ajustes. El
     mosaico no lee el store: se la pasa quien lo monta, como los hallazgos. */
  const iaCortes = useDocStore((s) => s.iaCortes);
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setAncho(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const rackVisible = ancho >= RACK_BREAKPOINT;
  /* El ancho de la columna del minimapa y el corte por debajo del cual desaparece
     los DECIDE el componente (`ReviewMinimap`), no esta vista. Duplicar el número
     acá es exactamente la clase de acuerdo que este hook ya no quiere: dos
     números en dos archivos que se desincronizan, y una grilla que reserva una
     columna que nadie pintó. La grilla guarda la columna con la MISMA regla que
     la esconde, y por eso no queda un hueco vacío en su lugar. */
  const minimapVisible = ancho >= MINIMAP_ANCHO_MINIMO;

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

  /* El "Escanear" del estado vacío es el MISMO verbo que el de la tira, con el
     mismo guardián de rechazo: el hook ya publica el resultado de cada motor
     con su propio aviso, así que lo único que no debe quedar es una promesa sin
     manejar en la consola. */
  const escanear = () => {
    Promise.resolve(wb.scanAll()).catch(() => undefined);
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

  /* La grilla reserva la columna del minimapa SOLO si él se va a pintar. Si se
     reservara siempre, en ventana angosta quedaría una columna de 44 px vacía al
     lado del texto, que es peor que no tener minimapa: se ve que falta algo y no
     se sabe qué. */
  const columnas = [
    ...(minimapVisible ? [`${MINIMAP_WIDTH}px`] : []),
    'minmax(0, 1fr)',
    ...(rackVisible ? [`${RACK_WIDTH}px`] : []),
  ].join(' ');

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
        {/* El minimapa se monta solo si la grilla reservó su columna. El componente
            por su lado también se esconde con la MISMA regla, y por eso esto no es
            una guarda redundante: es que las dos mitades de la decisión —el hueco
            en la grilla y el componente— tienen que caer juntas. */}
        {minimapVisible && (
          <ReviewMinimap
            totalPages={wb.totalPages}
            marks={wb.marks}
            currentPage={wb.currentPage}
            onPageClick={wb.goToPage}
          />
        )}

        {wb.viewMode === 'ia' ? (
          <AiHierarchy
            elements={doc?.elements ?? null}
            items={wb.items}
            activa={wb.phaseFilter}
            onSelectPhase={(key) => {
              wb.setPhaseFilter(key);
              wb.setFilter('ai');
              wb.setViewMode('focus');
            }}
            onApplyParaphrase={async (item, newText) => {
              if (item.element_id && doc) {
                await useDocStore.getState().updateElementText(item.element_id, newText);
                wb.dismiss(item);
              }
            }}
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
          /* El estado vacío vive AQUÍ, en la grilla principal, y no adentro del
             `<aside>` del rack. Esa es la diferencia entre un estado vacío y un
             texto que aparece solo si un panel está abierto: el rack se retira
             bajo 1180 px, y con él se retiraba el mensaje — pantalla vacía sin
             explicación. La grilla principal se renderiza siempre. */
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
            <FocusReadingCard item={wb.selected} totalFindings={enElBloque} />
          )
        ) : (
          /* Sin documento no hay elemento que resolver, y una tarjeta con el
             párrafo limpio y sin una sola marca es indistinguible de "el motor
             no encontró nada". El hueco se dice. */
          <EstadoVacio motivo="sin-documento" />
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
          </aside>
        )}
      </div>
    </div>
  );
}

export default ReviewWorkbench;
