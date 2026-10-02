/**
 * La lista de figuras y tablas: EL EJE de esta pantalla.
 *
 * Lo que hay adentro de cada fila no es un adorno, es la respuesta a la pregunta
 * que esta pantalla tiene que responder: "esta figura tiene contexto o esta
 * perdida en el mar". Son cinco datos y ninguno se rellena con un numero
 * inventado ni con un silencio:
 *
 *   1. El tamano REAL, de `medidaDeFigura` (la geometria de la hoja de F2), y si
 *      el elemento NO declara tamano se dice "sin tamano declarado". El `|| 12` y
 *      el `|| 8` de `ImageEditPanel.tsx` eran nueve numeros inventados que la
 *      pantalla mostraba como si fueran el dato.
 *   2. La leyenda, o la AUSENCIA DE LEYENDA DICHA. "Sin leyenda - APA 7 la exige"
 *      es un estado. Un hueco mudo no lo es.
 *   3. El H1/H2 al que pertenece, derivado por POSICION y no por `element_id`:
 *      los ids son `elem_N`, un indice posicional, y se corren cuando Word
 *      inserta arriba (`src/lib/figuras.ts`).
 *   4. El parrafo anterior, y `null` se dice en palabras. `null` y `''` son
 *      cosas distintas: `''` es "hay un parrafo vacio".
 *   5. Para una tabla, sus filas. Un icono de tabla no es un dato.
 *
 * COMPONENTE PURO, SIN STORE. La lista, el filtro y la seleccion los decide quien
 * compone; por eso esta pantalla se puede probar sin montar `App`.
 */
import React, { useState, type ReactNode } from 'react';
import { Image as ImageIcon, Table as TableIcon, Binary, ImageOff, Search, Filter, Sparkles, Loader2, PanelRight, X } from 'lucide-react';
import { EstadoVacio } from '../shared/EstadoVacio';
import { resolveAssetUrl } from '../../api/backend';
import {
  medidaDeFigura, type ContextoFigura, type TipoFigura,
} from '../../lib/figuras';
import type { ElementModel } from '../../types';

/** El alto maximo del header. Sin tope, con una ventana de 700 px el header se
 *  come la lista entera y el scroller queda en 0 px: es el defecto medido de
 *  `Step3FiguresTablesWizard.tsx:180-321` (`flexShrink: 0` sin `maxHeight`). */
const ALTO_MAXIMO_DEL_HEADER = '46vh';

/** Cuantas filas y cuantas columnas de una tabla se muestran en la lista. */
const FILAS_DE_TABLA = 2;
const COLUMNAS_DE_TABLA = 3;

export interface ListaContextualProps {
  contextos: readonly ContextoFigura[];
  tipo: TipoFigura;
  onTipoChange: (t: TipoFigura) => void;
  query: string;
  onQueryChange: (q: string) => void;
  soloPendientes: boolean;
  onSoloPendientesChange: (v: boolean) => void;
  /** La figura activa, por POSICION. `null` es "no hay ninguna elegida". */
  indiceActivo: number | null;
  onSelectIndice: (indice: number) => void;
  onAutoCaption: () => void;
  autoCaptionCargando: boolean;
  hayDocumento: boolean;
  /** Los conteos, para el toggle. Los cuenta quien compone, no esta pantalla. */
  conteoFiguras: number;
  conteoTablas: number;
  conteoEcuaciones?: number;

  /** El filtro que dejo la lista vacia, para que `EstadoVacio` lo nombre. */
  filtroActivo: string | null;
  /** Que se sabe de cada elemento, para el borde de "revisar". Se lo pasa el
   *  padre porque `needsReview` es regla del documento, no de esta pantalla. */
  necesitaRevision?: (c: ContextoFigura) => boolean;
  /** Los controles de tabla, que ya existen y no se tocan: se los pasa el padre
   *  como `children` para que esta pantalla no conozca `setTableStyle`. */
  children?: ReactNode;
  onColapsar?: () => void;
}

const etiquetaDe = (c: ContextoFigura): string =>
  c.tipo === 'image' ? 'Figura' : c.tipo === 'table' ? 'Tabla' : 'Ecuación';


/** El tamaño DECLARADO, o `null` si el documento no lo dice. */
const declarado = (c: ContextoFigura): { w: number; h: number } | null =>
  c.anchoCm !== null && c.altoCm !== null && c.anchoCm > 0 && c.altoCm > 0
    ? { w: c.anchoCm, h: c.altoCm }
    : null;

/** El texto de la posicion en la seccion, dicho y no calculado a la vista. */
function PosicionEnSeccion({ c }: { c: ContextoFigura }) {
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
      {c.posicionEnSeccion} de {c.totalEnSeccion} en esta sección
    </span>
  );
}

/**
 * La miniatura, con su TAMANO REAL.
 *
 * `onError` cae a un placeholder CON MARCO Y CON TEXTO. El defecto que se mata es
 * `Step3FiguresTablesWizard.tsx:399`, que hacía `visibility = hidden`: dejaba un
 * cuadro de 48 x 48 sin marco y sin texto, un agujero que parece un elemento que
 * se está cargando y no lo está.
 */
function MiniaturaFigura({ c }: { c: ContextoFigura }) {
  const [roto, setRoto] = useState(false);
  const url = c.url ? resolveAssetUrl(c.url) : null;
  const medida = medidaDeFigura(declarado(c) ? { width_cm: c.anchoCm!, height_cm: c.altoCm! } : null);

  if (!url || roto) {
    return (
      <div
        data-testid={url ? 'miniatura-de-reserva' : 'miniatura-sin-archivo'}
        style={{
          width: '56px', height: '56px', borderRadius: 'var(--radius-xs)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, padding: 2, textAlign: 'center',
          backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <ImageOff size={16} strokeWidth="var(--icon-stroke)" aria-hidden />
        {url ? (
          <span style={{ fontSize: '9px', lineHeight: 1.15 }}>No se pudo cargar la miniatura</span>
        ) : (
          <span style={{ fontSize: '9px', lineHeight: 1.15 }}>Sin archivo de imagen</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={c.rotulo}
      onError={() => setRoto(true)}
      style={{
        /* La caja mide lo que mide la figura en la hoja, y `maxWidth` la mantiene
           dentro de los 280 px del rail: una miniatura que se sale de la caja no
           es una miniatura. */
        width: `${Math.min(medida.anchoPx, 72)}px`,
        height: medida.declarada ? `${Math.min(medida.altoPx, 72)}px` : 'auto',
        maxWidth: '72px',
        borderRadius: 'var(--radius-xs)',
        objectFit: 'contain',
        flexShrink: 0,
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-subtle)',
      }}
    />
  );
}

/** La leyenda, o su ausencia dicha. El aviso va en el color de warning del token,
 *  que es un token: un color literal aqui rompe R3. */
function LineaDeLeyenda({ c }: { c: ContextoFigura }) {
  if (c.tieneLeyenda) {
    return (
      <div
        style={{
          fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic',
          marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        title={c.leyenda}
      >
        {c.leyenda}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginTop: 2 }}>
      Sin leyenda - APA 7 la exige
    </div>
  );
}

/** El tamano declarado, o la ausencia de tamano declarado. Nunca un literal. */
function LineaDeTamano({ c }: { c: ContextoFigura }) {
  if (c.tipo === 'table' || c.tipo === 'equation') return null;
  const d = declarado(c);

  if (!d) {
    return (
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', marginTop: 2 }}>
        Sin tamaño declarado
      </div>
    );
  }
  return (
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
      {d.w} × {d.h} cm
    </div>
  );
}

/** El parrafo anterior. `null` se DICE, no se pinta como una linea vacia. */
function LineaDeParrafoAnterior({ c }: { c: ContextoFigura }) {
  return (
    <div
      style={{
        fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 3, lineHeight: 1.35,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}
    >
      {c.parrafoAnterior ?? 'Es la primera figura de la sección, sin párrafo que la presente'}
    </div>
  );
}

/** La miga de la seccion: el H1 y el H2, no el id del elemento. */
function LineaDeSeccion({ c }: { c: ContextoFigura }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
        {c.h2 ? 'H2' : c.h1 ? 'H1' : 'H0'}
      </span>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.seccion}
      </span>
    </div>
  );
}

/** Las primeras filas de una tabla. Un icono de tabla no es un dato (§8.1). */
function DatosDeTabla({ c }: { c: ContextoFigura }) {
  const t = c.tabla;
  const filas = t?.rows ?? [];
  const headers = t?.headers ?? [];
  const columnas = Math.min(COLUMNAS_DE_TABLA, Math.max(headers.length, ...filas.map((f) => f.length), 0));
  if (filas.length === 0) {
    return (
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
        Esta tabla no trae datos en el documento
      </div>
    );
  }
  const mostradas = filas.slice(0, FILAS_DE_TABLA);
  return (
    <div style={{ marginTop: 3, minWidth: 0 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {Array.from({ length: columnas }, (_, i) => (
              <th
                key={i}
                style={{
                  fontSize: '9px', fontWeight: 700, textAlign: 'left', color: 'var(--color-text-secondary)',
                  borderBottom: '1px solid var(--border-subtle)', padding: '1px 3px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                title={headers[i]}
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
                  style={{
                    fontSize: '9px', color: 'var(--color-text-primary)', padding: '1px 3px',
                    borderBottom: '1px solid var(--border-subtle)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={fila[i]}
                >
                  {fila[i] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length > FILAS_DE_TABLA && (
        <div style={{ fontSize: '9px', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          Mostrando {FILAS_DE_TABLA} de {filas.length} filas
        </div>
      )}
    </div>
  );
}

function FilaFigura({
  c, activa, necesitaRevision, onSelectIndice,
}: {
  c: ContextoFigura; activa: boolean; necesitaRevision: (x: ContextoFigura) => boolean;
  onSelectIndice: (i: number) => void;
}) {
  const revisar = necesitaRevision(c);
  return (
    <button
      type="button"
      data-testid={`contexto-${c.id}`}
      onClick={() => onSelectIndice(c.indice)}
      aria-pressed={activa}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', width: '100%',
        padding: 'var(--space-2)', marginBottom: 'var(--space-1)', textAlign: 'left',
        cursor: 'pointer', fontFamily: 'inherit', borderRadius: 'var(--radius-sm)',
        borderLeft: revisar ? '3px solid var(--color-warning)' : '3px solid transparent',
        backgroundColor: activa ? 'var(--color-accent-soft)' : revisar ? 'var(--color-warning-a05)' : 'transparent',
        borderTop: '1px solid var(--border-subtle)',
        borderRight: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        minWidth: 0,
      }}
    >
      {c.tipo === 'image' ? <MiniaturaFigura c={c} /> : c.tipo === 'table' ? (
        <div
          style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius-xs)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <TableIcon size={18} strokeWidth="var(--icon-stroke)" aria-hidden />
        </div>
      ) : (
        <div
          style={{
            width: '56px', height: '56px', borderRadius: 'var(--radius-xs)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
            color: 'var(--accent-primary)',
          }}
        >
          <Binary size={18} strokeWidth="var(--icon-stroke)" aria-hidden />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {c.rotulo}
          </span>
          {revisorTexto(revisar)}
          <PosicionEnSeccion c={c} />
        </div>
        <LineaDeSeccion c={c} />
        <LineaDeLeyenda c={c} />
        <LineaDeTamano c={c} />
        {c.tipo === 'table' ? <DatosDeTabla c={c} /> : <LineaDeParrafoAnterior c={c} />}
      </div>

    </button>
  );
}

/** "revisar" es un estado dicho, con su color de token. */
function revisorTexto(revisar: boolean) {
  if (!revisar) return null;
  return (
    <span style={{ fontSize: '9px', color: 'var(--color-warning)', fontWeight: 700, flexShrink: 0 }}>
      revisar
    </span>
  );
}

export function ListaContextual({
  contextos, tipo, onTipoChange, query, onQueryChange, soloPendientes, onSoloPendientesChange,
  indiceActivo, onSelectIndice, onAutoCaption, autoCaptionCargando, hayDocumento,
  conteoFiguras, conteoTablas, conteoEcuaciones = 0, filtroActivo, necesitaRevision, children, onColapsar,
}: ListaContextualProps) {
  const nuncaRevisa = () => false;
  const revisa = necesitaRevision ?? nuncaRevisa;
  const visibles = contextos.filter((c) => c.tipo === tipo);

  return (
    <div
      style={{
        width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
        overflow: 'hidden', minHeight: 0, minWidth: 0,
        /* Esta columna no crece mas que la ventana, y lo dice: un `flexShrink: 0`
           sin tope es la forma de una columna que se sale de la pantalla. */
        maxHeight: '100%',
      }}
    >
      <div
        data-testid="lista-figuras-header"
        style={{
          padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)',
          /* `flexShrink: 0` SIN `maxHeight` es el header que se come la lista: con
             una ventana de 700 px el scroller de abajo queda en 0 px (§8.4). */
          flexShrink: 0,
          maxHeight: ALTO_MAXIMO_DEL_HEADER,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {tipo === 'image'
            ? <ImageIcon size={16} strokeWidth="var(--icon-stroke)" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} aria-hidden />
            : tipo === 'table'
            ? <TableIcon size={16} strokeWidth="var(--icon-stroke)" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} aria-hidden />
            : <Binary size={16} strokeWidth="var(--icon-stroke)" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} aria-hidden />}
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', flex: 1, minWidth: 0 }}>
            Figuras y tablas ({contextos.length})
          </span>
          {contextos.length > 0 && (
            <button
              type="button"
              onClick={onAutoCaption}
              disabled={autoCaptionCargando}
              title="Sugerir leyendas APA 7 con IA para todas las figuras y tablas sin título"
              aria-label="Leyendas IA para todo"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                cursor: autoCaptionCargando ? 'wait' : 'pointer',
                fontFamily: 'inherit', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-accent-soft)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
              }}
            >
              {autoCaptionCargando
                ? <Loader2 size={12} strokeWidth="var(--icon-stroke)" style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                : <Sparkles size={12} strokeWidth="var(--icon-stroke)" aria-hidden />}
              {autoCaptionCargando ? 'Generando…' : 'Leyendas IA'}
            </button>
          )}
          {onColapsar && (
            <button
              type="button"
              onClick={onColapsar}
              title="Colapsar lista y dejar más lugar a la figura"
              aria-label="Colapsar lista"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
                cursor: 'pointer', background: 'transparent', border: 'none',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)', flexShrink: 0,
              }}
            >
              <PanelRight size={12} strokeWidth="var(--icon-stroke)" aria-hidden style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => onTipoChange('image')}
            aria-pressed={tipo === 'image'}
            style={{
              flex: 1, border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: 'var(--text-xs)', fontWeight: 500,
              backgroundColor: tipo === 'image' ? 'var(--color-accent-soft)' : 'transparent',
              color: tipo === 'image' ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Figuras ({conteoFiguras})
          </button>
          <button
            type="button"
            onClick={() => onTipoChange('table')}
            aria-pressed={tipo === 'table'}
            style={{
              flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer',
              padding: '5px 0', fontSize: 'var(--text-xs)', fontWeight: 500,
              backgroundColor: tipo === 'table' ? 'var(--color-accent-soft)' : 'transparent',
              color: tipo === 'table' ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Tablas ({conteoTablas})
          </button>
          <button
            type="button"
            onClick={() => onTipoChange('equation')}
            aria-pressed={tipo === 'equation'}
            style={{
              flex: 1, border: 'none', borderLeft: '1px solid var(--border-subtle)', cursor: 'pointer',
              padding: '5px 0', fontSize: 'var(--text-xs)', fontWeight: 500,
              backgroundColor: tipo === 'equation' ? 'var(--color-accent-soft)' : 'transparent',
              color: tipo === 'equation' ? 'var(--accent-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Ecuaciones ({conteoEcuaciones})
          </button>
        </div>


        <div style={{ display: 'flex', gap: 4, marginTop: 'var(--space-2)', alignItems: 'center' }}>
          <div
            style={{
              flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
              padding: '3px 6px', backgroundColor: 'var(--canvas-bg)',
            }}
          >
            <Search size={11} strokeWidth="var(--icon-stroke)" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Buscar figura"
              placeholder="Buscar por número, título o sección…"
              style={{
                border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: 'var(--text-xs)',
                backgroundColor: 'transparent', color: 'var(--text-main)', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Limpiar búsqueda"
                style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={11} strokeWidth="var(--icon-stroke)" aria-hidden />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSoloPendientesChange(!soloPendientes)}
            aria-pressed={soloPendientes}
            title="Mostrar solo elementos pendientes de revisión"
            aria-label="Solo pendientes"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 7px',
              fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', flexShrink: 0,
              backgroundColor: soloPendientes ? 'var(--color-warning-a12)' : 'transparent',
              border: `1px solid ${soloPendientes ? 'var(--color-warning-a40)' : 'var(--border-subtle)'}`,
              color: soloPendientes ? 'var(--color-warning)' : 'var(--color-text-secondary)',
            }}
          >
            <Filter size={11} strokeWidth="var(--icon-stroke)" aria-hidden /> Pendientes
          </button>
        </div>

        {children}

        {visibles.some(revisa) && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
            {visibles.filter(revisa).length} pendiente{visibles.filter(revisa).length > 1 ? 's' : ''} de revisión
          </div>
        )}
      </div>

      {/* El scroller. Las dos cajas que le faltan hoy al de
         `Step3FiguresTablesWizard.tsx:323`: sin `minHeight: 0` un `flex: 1` dentro
         de un padre column no baja de su alto de contenido, y el scroller queda
         en 0 px con una ventana de 700 px de alto. */}
      <div
        data-testid="lista-figuras-scroller"
        style={{
          flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto',
          padding: 'var(--space-2)',
        }}
      >
        {!hayDocumento ? (
          <EstadoVacio motivo="sin-documento" />
        ) : visibles.length === 0 ? (
          <EstadoVacio
            motivo="sin-resultados"
            filtroActivo={filtroActivo}
            accion={
              filtroActivo ? (
                <button
                  type="button"
                  onClick={() => { onQueryChange(''); onSoloPendientesChange(false); }}
                  style={{
                    padding: '6px 14px', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)', color: 'var(--color-text-on-accent)',
                    border: '1px solid var(--accent-primary)',
                  }}
                >
                  Quitar el filtro
                </button>
              ) : null
            }
          />
        ) : (
          visibles.map((c) => (
            <FilaFigura
              key={c.indice}
              c={c}
              activa={c.indice === indiceActivo}
              necesitaRevision={revisa}
              onSelectIndice={onSelectIndice}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ListaContextual;
