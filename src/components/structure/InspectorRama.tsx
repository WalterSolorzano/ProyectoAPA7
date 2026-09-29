/* WordAPA7 — el inspector de rama: qué hay adentro y qué se puede hacer SOLO ahí.
 *
 * CUATRO ACCIONES, Y CADA UNA DICE A QUÉ ALCANCE APLICA.
 *
 * "Reordenar" en un índice jerárquico sin decir a qué aplica es una amenaza, y
 * una acción que dice "esta rama" y toca las hermanas es PEOR que una que no
 * existiera. Por eso el alcance está declarado en una tabla —`ACCIONES`— y se
 * PINTA junto al botón: un alcance que solo existe en el código no evita la
 * amenaza, porque la amenaza es de quien no lee el código.
 *
 * Y LAS CUATRO APLICAN DE VERDAD, cada una por su endpoint:
 *
 *   promover    -> `updateElementType` -> POST /api/update-element
 *   reordenar   -> `reorderElements`    -> POST /api/reorder-elements
 *   renombrar   -> `updateElementText`  -> POST /api/update-element
 *   consultar   -> `sendLiveChat`       -> POST /api/ai/live-chat
 *
 * Lo que no tiene endpoint NO ENTRA en la lista. No hay forma de insertar un
 * capítulo, y por eso esa acción no está en `FaltasApa7`. Un botón que no hace
 * nada ocupa el lugar del que sí, y esa es la clase de defecto que este
 * proyecto vino a matar.
 *
 * LA RAMA SE MUEVE ENTERA. "Mover esta rama abajo" no mueve el encabezado: mueve
 * el encabezado y todo lo que cuelga de él, y deja a sus hermanas con su
 * contenido intacto. Mover solo el título dejaría el cuerpo del capítulo
 * colgando de otro, que es un documento roto.
 */

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, MessageSquare, PenLine, TriangleAlert } from 'lucide-react';
import type { NodoJerarquia } from '../../lib/jerarquia';
import { sendLiveChat } from '../../api/backend';
import { useDocStore } from '../../store/useDocStore';
import { promoverPorDefecto } from './FaltasApa7';
import { miles } from './BarraBalance';
import type { ElementModel } from '../../types';

export type ClaveAccion = 'promover' | 'reordenar' | 'renombrar' | 'consultar-ia';
/** A qué aplica la acción. Se Pinta, no se supone. */
export type AlcanceAccion = 'esta-rama' | 'todo-el-documento';

export interface AccionRama {
  clave: ClaveAccion;
  /** Lo que dice el botón. */
  etiqueta: string;
  /** Lo que se pinta JUNTO al botón, y es la mitad del contrato. */
  etiquetaAlcance: string;
  alcance: AlcanceAccion;
  /** Por qué esta acción existe y no es un botón mudo. */
  porQue: string;
}

/**
 * LAS CUATRO ACCIONES, y solo las que se pueden hacer.
 *
 * La tabla es el contrato: si una acción no tiene backend, no se declara acá, y
 * la pantalla no la muestra. Agregar una fila sin endpoint es agregar un botón
 * mudo.
 */
export const ACCIONES: AccionRama[] = [
  {
    clave: 'promover',
    etiqueta: 'Promover a H1',
    etiquetaAlcance: 'esta rama',
    alcance: 'esta-rama',
    porQue: 'Cambia el nivel del encabezado. Sale por /api/update-element y el documento se repone con la respuesta del servidor.',
  },
  {
    clave: 'reordenar',
    etiqueta: 'Mover esta rama',
    etiquetaAlcance: 'esta rama',
    alcance: 'esta-rama',
    porQue: 'Mueve el encabezado y todo lo que cuelga de él, entre sus hermanas. Sale por /api/reorder-elements.',
  },
  {
    clave: 'renombrar',
    etiqueta: 'Renombrar',
    etiquetaAlcance: 'esta rama',
    alcance: 'esta-rama',
    porQue: 'Cambia el texto del encabezado. Sale por /api/update-element.',
  },
  {
    clave: 'consultar-ia',
    etiqueta: 'Preguntarle a la IA',
    etiquetaAlcance: 'esta rama',
    alcance: 'esta-rama',
    porQue: 'Pregunta qué debería ir en esta sección, con el contenido de la rama. Sale por /api/ai/live-chat.',
  },
];

/** El alcance declarado de una acción, o `null` si la acción no existe. */
export function alcanceDe(clave: ClaveAccion): AlcanceAccion | null {
  return ACCIONES.find((a) => a.clave === clave)?.alcance ?? null;
}

/* ── Mover una rama ────────────────────────────────────────────────────────── */

/**
 * El documento partido en TRAMOS: un tramo por capítulo, más el tramo inicial
 * si el documento empieza con algo que no es un encabezado.
 *
 * Un tramo es un bloque contiguo del documento, y es la unidad que se mueve. Mover
 * el encabezado sin su tramo dejaría el cuerpo del capítulo colgando de otro,
 * que es un documento roto.
 */
function tramosDe(elementos: readonly ElementModel[]): ElementModel[][] {
  const tramos: ElementModel[][] = [];
  for (const e of elementos) {
    const abre = e.type === 'heading' && (e.heading_level ?? 1) === 1;
    if (abre || tramos.length === 0) tramos.push([e]);
    else tramos[tramos.length - 1].push(e);
  }
  return tramos;
}

/**
 * El orden nuevo de TODO el documento si esta rama se mueve entre sus hermanas.
 *
 * `null` cuando no se puede: una rama que ya está al borde no se mueve, y
 * devolver el orden sin cambios sería un botón que dice que hizo algo.
 *
 * Se devuelve el orden COMPLETO de ids porque el endpoint reordena por lista
 * completa: un "mover una posición" sin el resto del orden no dice nada. Y se
 * intercambian TRAMOS, no elementos sueltos, que es lo que hace que las hermanas
 * conserven su contenido y su orden relativo.
 */
export function moverRama(
  nodo: NodoJerarquia,
  elementos: readonly ElementModel[],
  direccion: 'arriba' | 'abajo',
): string[] | null {
  const tramos = tramosDe(elementos);
  const i = tramos.findIndex((t) => t[0]?.id === nodo.elementoId);
  if (i < 0) return null;
  const j = direccion === 'arriba' ? i - 1 : i + 1;
  /* El tramo 0 puede ser el preámbulo —lo que hay antes del primer capítulo— y
     ese no es un capítulo que se pueda subir: mover un capítulo por encima del
     preámbulo lo metería dentro de la portada. */
  if (j < 0 || j >= tramos.length) return null;
  if (direccion === 'arriba' && j === 0 && elementos[0]?.id !== nodo.elementoId) {
    const antesEsEncabezado =
      tramos[0][0]?.type === 'heading' && (tramos[0][0]?.heading_level ?? 1) === 1;
    if (!antesEsEncabezado) return null;
  }
  const orden = tramos.slice();
  [orden[i], orden[j]] = [orden[j], orden[i]];
  return orden.flat().map((e) => e.id);
}

/* ── Preguntar a la IA ─────────────────────────────────────────────────────── */

/** Los textos de la rama, para que la pregunta no sea sobre el título solo. */
function textosDeRama(nodo: NodoJerarquia, elementos: readonly ElementModel[]): string[] {
  const tramo = tramosDe(elementos).find((t) => t[0]?.id === nodo.elementoId) ?? [];
  return tramo
    .filter((e) => e.type !== 'heading' && (e.text || '').trim())
    .map((e) => e.text.trim());
}

/** Lo que se le pregunta a la IA, y que por eso tiene que NOMBRAR la rama. */
export function preguntaDeIa(nodo: NodoJerarquia): string {
  return `¿Qué debería ir en la sección "${nodo.titulo}" de este documento?`;
}

/** La pregunta con el contenido de la rama, que es lo que la hace útil. */
export function preguntasDeIa(nodo: NodoJerarquia, elementos: readonly ElementModel[] = []): string {
  const textos = textosDeRama(nodo, elementos);
  const cuerpo = textos.length > 0 ? `\n\nHoy dice:\n${textos.join('\n')}` : '\n\nLa sección está vacía.';
  return `${preguntaDeIa(nodo)}${cuerpo}`;
}

/* ── El componente ─────────────────────────────────────────────────────────── */

export interface InspectorRamaProps {
  nodo: NodoJerarquia;
  /** Los elementos del documento: hacen falta para mover la rama y para
   *  mostrar qué hay adentro. */
  elementos: readonly ElementModel[];
  onPromover?: (nodo: NodoJerarquia) => void | Promise<void>;
  onRenombrar?: (nodo: NodoJerarquia, titulo: string) => void | Promise<void>;
  onReordenar?: (nodo: NodoJerarquia, direccion: 'arriba' | 'abajo') => void | Promise<void>;
  onConsultarIa?: (nodo: NodoJerarquia, pregunta: string) => void | Promise<void>;
}

export const InspectorRama: React.FC<InspectorRamaProps> = ({
  nodo,
  elementos,
  onPromover,
  onRenombrar,
  onReordenar,
  onConsultarIa,
}) => {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(nodo.titulo);
  const [respuesta, setRespuesta] = useState<string | null>(null);

  const textos = useMemo(() => textosDeRama(nodo, elementos), [nodo, elementos]);
  const puedeSubir = moverRama(nodo, elementos, 'arriba') !== null;
  const puedeBajar = moverRama(nodo, elementos, 'abajo') !== null;
  const esH1 = nodo.nivel === 1;

  const promover = onPromover ?? promoverPorDefecto;
  const renombrar = onRenombrar ?? ((n: NodoJerarquia, titulo: string) => {
    if (!n.elementoId) return;
    return useDocStore.getState().updateElementText(n.elementoId, titulo);
  });
  const reordenar = onReordenar ?? ((n: NodoJerarquia, direccion: 'arriba' | 'abajo') => {
    const orden = moverRama(n, elementos, direccion);
    const doc = useDocStore.getState().doc;
    if (!orden || !doc) return;
    return useDocStore.getState().reorderElements(orden);
  });
  const consultar = onConsultarIa ?? (async (n: NodoJerarquia, pregunta: string) => {
    const doc = useDocStore.getState().doc;
    if (!doc) return;
    const res = await sendLiveChat(doc.session_id, pregunta, n.elementoId);
    setRespuesta(res?.reply ?? null);
  });

  const boton = (clave: ClaveAccion, children: React.ReactNode): React.ReactElement => {
    const accion = ACCIONES.find((a) => a.clave === clave)!;
    return (
      <button
        type="button"
        disabled={false}
        title={accion.porQue}
        onClick={() => {
          if (clave === 'promover') void promover(nodo);
          if (clave === 'reordenar') void reordenar(nodo, 'abajo');
          if (clave === 'renombrar') setEditando(true);
          if (clave === 'consultar-ia') void consultar(nodo, preguntasDeIa(nodo, elementos));
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          font: 'inherit',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        {children}
        {/* EL ALCANCE, AL LADO DEL BOTÓN. Es la mitad del contrato: sin esto,
            "mover" es una amenaza y con esto es una operación con alcance. */}
        <span style={{ color: 'var(--color-text-tertiary)' }}>({accion.etiquetaAlcance})</span>
      </button>
    );
  };

  return (
    <section
      aria-label={`Rama ${nodo.titulo}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {editando ? (
          <>
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              aria-label="Nuevo nombre de la sección"
              style={{
                flex: '1 1 auto',
                font: 'inherit',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-focus)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 6px',
              }}
            />
            <button
              type="button"
              onClick={() => {
                void renombrar(nodo, borrador.trim() || nodo.titulo);
                setEditando(false);
              }}
              style={{
                font: 'inherit', fontSize: 'var(--text-xs)', cursor: 'pointer',
                color: 'var(--color-text-on-accent)', background: 'var(--color-accent)',
                border: '1px solid transparent', borderRadius: 'var(--radius-sm)', padding: '3px 8px',
              }}
            >
              Guardar
            </button>
          </>
        ) : (
          <span
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={nodo.titulo}
          >
            {nodo.titulo}
          </span>
        )}
      </header>

      {/* La rama: sus párrafos, sus figuras y sus citas. */}
      {nodo.palabras === 0 ? (
        <p role="status" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          <TriangleAlert
            size={13}
            strokeWidth="var(--icon-stroke)"
            aria-hidden
            style={{ marginRight: '6px', verticalAlign: '-2px', color: 'var(--color-warning)' }}
          />
          Esta rama está sin contenido: existe el encabezado y no hay nada debajo.
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {textos.map((t, i) => (
            <li
              key={i}
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={t}
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        {miles(nodo.palabras)} palabras
        {nodo.figuras > 0 ? ` · ${nodo.figuras} figuras` : ''}
        {nodo.tablas > 0 ? ` · ${nodo.tablas} tablas` : ''}
        {nodo.citas > 0 ? ` · ${nodo.citas} citas` : ''}
      </p>

      {/* Las cuatro acciones, con su alcance a la vista. */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {!esH1 && boton('promover', <>Promover a H1</>)}
        <button
          type="button"
          disabled={!puedeSubir}
          title={ACCIONES[1].porQue}
          onClick={() => void reordenar(nodo, 'arriba')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', font: 'inherit',
            fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '3px 8px',
            cursor: puedeSubir ? 'pointer' : 'not-allowed', opacity: puedeSubir ? 1 : 0.5,
          }}
        >
          <ArrowUp size={13} strokeWidth="var(--icon-stroke)" aria-hidden />
          Subir <span style={{ color: 'var(--color-text-tertiary)' }}>({ACCIONES[1].etiquetaAlcance})</span>
        </button>
        <button
          type="button"
          disabled={!puedeBajar}
          title={ACCIONES[1].porQue}
          onClick={() => void reordenar(nodo, 'abajo')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', font: 'inherit',
            fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '3px 8px',
            cursor: puedeBajar ? 'pointer' : 'not-allowed', opacity: puedeBajar ? 1 : 0.5,
          }}
        >
          <ArrowDown size={13} strokeWidth="var(--icon-stroke)" aria-hidden />
          Bajar <span style={{ color: 'var(--color-text-tertiary)' }}>({ACCIONES[1].etiquetaAlcance})</span>
        </button>
        {boton('renombrar', <><PenLine size={13} strokeWidth="var(--icon-stroke)" aria-hidden />Renombrar</>)}
        {boton(
          'consultar-ia',
          <><MessageSquare size={13} strokeWidth="var(--icon-stroke)" aria-hidden />Preguntarle a la IA</>,
        )}
      </div>

      {respuesta && (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {respuesta}
        </p>
      )}
    </section>
  );
};

export default InspectorRama;
