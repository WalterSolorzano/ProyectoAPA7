/* WordAPA7 — el escritorio de redacción: la fase de Estructura, compuesta.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Los siete componentes de esta carpeta estaban
 * terminados y probados, y NADIE los montaba: un `grep` de importadores fuera de
 * la carpeta no daba un solo resultado. Es el defecto que este proyecto vino a
 * matar en su propia carne —trabajo terminado, con tests, que no llega a la
 * pantalla— y por eso el guardián que lo vigila es
 * `src/__tests__/estructuraEstaMontada.test.tsx`.
 *
 * LA COMPOSICIÓN, EN EL ORDEN QUE PIDE EL SPEC §7:
 *
 *   1. el pulso de cinco números arriba, y nada más;
 *   2. el índice jerárquico con su diagnóstico, al centro;
 *   3. el inspector de la rama elegida, a la derecha, con sus cuatro acciones;
 *   4. qué le falta a APA 7, al pie de la columna derecha.
 *
 * EL CENTRO ES EL ÍNDICE, Y EL DOCUMENTO ES UN TOGGLE APAGADO. Ese fue el
 * defecto reportado: el centro era el archivo vomitado. Por eso la fase 2 abre
 * acá y no en el lienzo.
 *
 * Y LA FASE 2 TIENE TRES PESTAÑAS, no una. "Índice" es la que se ve al llegar y
 * es esta; "Títulos" es el lienzo con el revisor secuencial, y "Cuerpo" el
 * editor de prosa, que ya existían y no se tocan. El documento entero también
 * entra por el toggle "ver el documento" del índice, y ahí se monta el MISMO
 * `Step2HeadingsWizard`: son dos caminos al mismo lugar y no es un descuido, es
 * que la fase tiene una navegación de nivel de fase y otra de nivel de vista, y
 * el índice necesita la suya para poder medir sin dejar de editar.
 *
 * LA LISTA DE FASES OBLIGATORIAS NO SE INVENTA. `RULE_SCAPES` declara el ÁMBITO
 * de cada regla, no qué secciones exige APA 7, y no hay endpoint que lo exponga.
 * `FaltasApa7` la recibe por prop y esta pantalla NO le pasa ninguna: la
 * ausencia de la lista es ausencia de dato, y por eso se lo dice al lado de la
 * lista en vez de fabricar dieciocho capítulos para escribir.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ListTree, ScrollText } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { collectAuditItems } from '../../lib/auditItems';
import { construirJerarquia, type FasesConocidas, type NodoJerarquia } from '../../lib/jerarquia';
import { IndiceEstructura } from './IndiceEstructura';
import { InspectorRama } from './InspectorRama';
import { FaltasApa7 } from './FaltasApa7';
import { PulsoDocumento } from './PulsoDocumento';

export interface EscritorioEstructuraProps {
  /**
   * El documento entero, como contenido del toggle "ver el documento".
   *
   * Es una prop y no un import directo por una razón concreta: quien compone la
   * fase es quien sabe qué es "el documento" en este contexto —el lienzo con el
   * revisor de títulos, hoy—, y meterlo acá ataría esta pantalla a una pantalla
   * que puede cambiar sin que nadie avise.
   */
  documento?: React.ReactNode;
  /** Si se pasa, el nodo con el que arranca abierto el inspector. */
  nodoInicial?: NodoJerarquia | null;
}

/**
 * La fase por la que ya calculó el backend, por elemento.
 *
 * Sale de la MISMA lista de hallazgos que cuenta el rail y que abre el
 * workbench (`lib/auditItems`), no de un segundo recorrido: un mapa de fases
 * derivado aparte es la forma de que el mosaico diga una fase y el auditor
 * otra. Los hallazgos generales no traen fase y no aportan nada acá, que es lo
 * correcto: un error de ortografía no abre ningún ámbito.
 */
export function fasesConocidasDe(
  elementos: readonly { id: string }[],
  items: readonly { element_id: string; phase: string | null }[],
): FasesConocidas {
  const mapa: Record<string, string> = {};
  for (const el of elementos) {
    const fase = items.find((i) => i.element_id === el.id && i.phase)?.phase;
    if (fase) mapa[el.id] = fase;
  }
  return mapa;
}

export const EscritorioEstructura: React.FC<EscritorioEstructuraProps> = ({
  documento,
  nodoInicial = null,
}) => {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const [elegido, setElegido] = useState<NodoJerarquia | null>(nodoInicial);

  const elementos = doc?.elements ?? null;

  /* La lista es la del rail, la del workbench y la del pulso. Una sola. */
  const hallazgos = useMemo(
    () =>
      collectAuditItems({
        elements: elementos ?? [],
        reviewResult,
        proofreadFindings,
        citationAuditResult,
      }),
    [elementos, reviewResult, proofreadFindings, citationAuditResult],
  );

  const faseConocida = useMemo(
    () => fasesConocidasDe(elementos ?? [], hallazgos),
    [elementos, hallazgos],
  );

  const raices = useMemo(
    () => construirJerarquia(elementos ?? [], faseConocida),
    [elementos, faseConocida],
  );

  /* Auto-seleccionar el primer capítulo si no hay ninguno seleccionado */
  const nodoActivo = useMemo(() => {
    if (elegido) return elegido;
    if (raices.length > 0) return raices[0];
    return null;
  }, [elegido, raices]);

  const buscar = useCallback(
    (id: string): NodoJerarquia | null => {
      for (const r of raices) {
        if (r.id === id) return r;
        const hijo = buscarEn(r.hijos, id);
        if (hijo) return hijo;
      }
      return null;
    },
    [raices],
  );

  /* Elegir una falta trae su rama al inspector: el "ver la rama" de
     `FaltasApa7` pasa un id y quien decide qué abrir es esta pantalla, que es la
     que tiene el árbol. */
  const abrirPorId = useCallback(
    (id: string) => setElegido(buscar(id)),
    [buscar],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        backgroundColor: 'var(--canvas-bg)',
      }}
    >
      {/* 1. EL PULSO. Cinco números y nada más, arriba de todo. */}
      <div
        style={{
          flexShrink: 0,
          padding: 'var(--space-3) var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <PulsoDocumento elementos={elementos} hallazgos={hallazgos} faseConocida={faseConocida} />
      </div>

      {/* 2 y 3. El índice al centro; el inspector de la rama a la derecha. */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <IndiceEstructura
            elementos={elementos}
            faseConocida={faseConocida}
            documento={documento}
            onSelect={setElegido}
            nodoSeleccionadoId={nodoActivo?.id}
          />
        </div>

        <aside
          aria-label="Rama elegida y faltas de APA 7"
          style={{
            flex: '0 0 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-5)',
            overflowY: 'auto',
            borderLeft: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface)',
          }}
        >
          {elegido ? (
            <InspectorRama nodo={elegido} elementos={elementos ?? []} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface-alt)',
                border: '1px dashed var(--color-border-subtle)',
              }}
            >
              <p
                role="status"
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                }}
              >
                <ListTree size={16} strokeWidth="var(--icon-stroke)" aria-hidden style={{ color: 'var(--color-accent)' }} />
                Elegí un capítulo del índice para ver su contenido y lo que se puede hacer ahí.
              </p>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                Podrás revisar el balance de palabras, editar el título directamente, promover su nivel o reordenarlo.
              </span>
            </div>
          )}

          {/* 4. REVISIÓN DE JERARQUÍA APA 7 */}
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
              marginTop: 'auto',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--color-border-subtle)',
            }}
            aria-label="Qué le falta a APA 7"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ScrollText size={15} strokeWidth="var(--icon-stroke)" aria-hidden style={{ color: 'var(--color-accent)' }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                Qué le falta a APA 7
              </h2>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              El backend no expone qué secciones exige APA 7 en una tesis, así que esta lista solo puede señalar los encabezados mal nivelados. No inventa los capítulos que faltarían.
            </p>
            <FaltasApa7 raices={raices} onSelect={abrirPorId} />
          </section>
        </aside>
      </div>
    </div>
  );
};

/** Búsqueda en el árbol entero, H2 y H3 incluidos: una fase mal puesta cuelga. */
function buscarEn(nodos: readonly NodoJerarquia[], id: string): NodoJerarquia | null {
  for (const n of nodos) {
    if (n.id === id) return n;
    const hijo = buscarEn(n.hijos, id);
    if (hijo) return hijo;
  }
  return null;
}

export default EscritorioEstructura;
