/**
 * F1 · Task 3 — el estado vacío de la app, en un solo lugar.
 *
 * Antes de esto cada superficie escribía su propio texto de "no hay nada", y cada
 * uno lives inside de un panel que se puede esconder. El de Revisión vivía en el
 * `<aside>` del rack, que solo se renderiza con `rackVisible`: con la ventana bajo
 * 1180 px no había rack, y con el no había mensaje. Una pantalla vacía sin
 * explicación es un estado que no informa.
 *
 * La regla que este componente impone es una sola: cada motivo dice SU CAUSA, en
 * palabras, y no dice la posición de un panel que puede no haber. Un texto que
 * nombra "el panel de la derecha" en una ventana donde no hay panel a la derecha
 * es un texto que miente, y mentir en un estado vacío es peor que no decir nada:
 * el usuario busca el panel que no existe.
 */
import type { ReactNode } from 'react';
import { FileQuestion, Inbox, FilterX, MousePointerClick } from 'lucide-react';

export type MotivoVacio = 'sin-documento' | 'sin-motor' | 'sin-resultados' | 'sin-seleccion';

export interface EstadoVacioProps {
  motivo: MotivoVacio;
  /** El filtro que dejó la pantalla vacía, cuando lo hay. Se NOMBRA en el texto. */
  filtroActivo?: string | null;
  /** La acción disponible, cuando hay una. Un estado vacío sin salida es un callejón. */
  accion?: ReactNode;
}

interface Texto {
  titulo: string;
  detalle: string;
  Icon: typeof FileQuestion;
}

/* `sin-resultados` es el único que NOMBRA algo externo, así que es el único que
   arma su texto con un dato. Los otros tres son Literales porque no tienen nada
   que leer: un texto que se arma con un valor que puede no existir tiene dos
   ramas, y la rama del valor ausente es la que dice "no hay resultados". */
const TEXTOS: Record<MotivoVacio, Texto> = {
  'sin-documento': {
    Icon: FileQuestion,
    titulo: 'No hay ningun documento abierto',
    detalle:
      'Carga un archivo .docx o crea uno nuevo. Sin documento no hay nada que revisar, y esta pantalla no tiene nada que mostrar todavia.',
  },
  'sin-motor': {
    Icon: Inbox,
    titulo: 'Todavia no corrio ningun motor',
    detalle:
      'Ningún motor reportó hallazgos todavía. Pulsa "Escanear" para correr la revisión completa.',
  },
  'sin-resultados': {
    Icon: FilterX,
    titulo: 'El filtro dejo la pantalla vacia',
    detalle:
      'El documento tiene hallazgos, pero ninguno pasa el filtro que esta activo. Vuelve a "Todo" para verlos.',
  },
  'sin-seleccion': {
    Icon: MousePointerClick,
    titulo: 'No hay ningun hallazgo seleccionado',
    detalle:
      'Hay hallazgos en el documento. Pulsa "Siguiente hallazgo" para recorrerlos de a uno, o elige cualquiera de la lista de motores.',
  },
};

export function EstadoVacio({ motivo, filtroActivo, accion }: EstadoVacioProps) {
  const { Icon, titulo, detalle } = TEXTOS[motivo];
  /* El filtro se nombra acá y no en el texto fijo, porque es el único dato que
     cambia y es el único que el usuario puede tocar para arreglar la pantalla.
     Sin nombrarlo, el mensaje dice "el filtro" y el usuario tiene que adivinar
     cuál de los cinco era. */
  const conFiltro =
    motivo === 'sin-resultados' && filtroActivo
      ? `${detalle} El filtro activo es "${filtroActivo}".`
      : detalle;

  return (
    <div
      data-testid="estado-vacio"
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-8) var(--space-6)',
        textAlign: 'center',
        minWidth: 0,
        color: 'var(--color-text-primary)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <Icon size={20} strokeWidth="var(--icon-stroke)" />
      </span>

      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        {titulo}
      </p>

      <p
        style={{
          margin: 0,
          maxWidth: '52ch',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.5,
          color: 'var(--color-text-tertiary)',
        }}
      >
        {conFiltro}
      </p>

      {accion}
    </div>
  );
}

export default EstadoVacio;
