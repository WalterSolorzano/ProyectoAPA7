/* WordAPA7 — el pulso del documento: cinco números y nada más.
 *
 * QUÉ ES. Lo que un redactor mira primero y que no existía en ninguna parte de
 * la app: cuántas palabras tiene el documento, cómo se equilibran sus
 * capítulos, qué secciones de APA 7 no están, cuántas figuras no tienen
 * leyenda y cuántas referencias de la bibliografía no se citan.
 *
 * CINCO Y NO SEIS. La regla de "no sobrecargar" escrita como número: si aparece
 * una celda más, es porque alguien empezó a agregar cosas, y un panel que
 * crece es un panel que nadie lee entero. Cada celda dice SU valor con SU
 * nombre: un número sin nombre es un número que nadie sabe qué mide, y un
 * ícono en vez del nombre es una adivinanza.
 *
 * `balance: null` ES UN ESTADO, NO UN CERO. Un documento de un solo capítulo no
 * tiene balance —no tiene con qué compararse—, y mostrarle 100 % lo convierte
 * en una nota que no es. La celda dice "no hay con qué comparar", que es la
 * verdad y además es más útil que un número falso.
 *
 * Y LAS REFERENCIAS SIN CITAR SALEN DE LA MISMA LISTA que abre el workbench y
 * que cuenta el rail. Un segundo conteo de referencias es la forma de que el
 * pulso diga 2 y la revisión diga 3, que es justo lo que `railPending.ts` existe
 * para impedir.
 */

import React, { useMemo } from 'react';
import {
  balanceDe,
  construirJerarquia,
  preambuloDe,
  type FasesConocidas,
  type VocabularioFases,
} from '../../lib/jerarquia';
import { faltasApa7 } from './FaltasApa7';
import { miles } from './BarraBalance';
import type { AuditItem } from '../../lib/auditItems';
import type { ElementModel } from '../../types';

/**
 * Los cinco números del documento.
 *
 * `balance` es la rama más corta medida contra la más larga, en porcentaje, y
 * `null` cuando hay menos de dos capítulos. `fasesQueFaltan` trae los NOMBRES,
 * porque este tipo se muestra: la clave es dato interno y la persona lee
 * "Resultados", no "resultados".
 */
export type Pulso = {
  palabras: number;
  balance: number | null;
  fasesQueFaltan: string[];
  figurasSinLeyenda: number;
  referenciasNoCitadas: number;
};

export interface OpcionesPulso {
  fasesRequeridas?: readonly string[];
  hallazgos?: readonly AuditItem[];
  faseConocida?: FasesConocidas;
  vocabulario?: VocabularioFases;
}

/** Las figuras —y las tablas— que no tienen leyenda escrita. */
function sinLeyenda(elementos: readonly ElementModel[]): number {
  return elementos.filter((e) => {
    if (e.type !== 'image' && e.type !== 'table') return false;
    const pie = (e.image_info?.caption ?? e.table_info?.caption ?? '').trim();
    return pie === '';
  }).length;
}

/** El pulso, calculado. Todo lo que el componente muestra sale de acá. */
export function pulsoDe(
  elementos: readonly ElementModel[],
  fasesRequeridas: readonly string[] = [],
  hallazgos: readonly AuditItem[] = [],
  faseConocida: FasesConocidas = {},
  vocabulario?: VocabularioFases,
): Pulso {
  const raices = construirJerarquia(elementos, faseConocida, vocabulario);
  const palabras =
    raices.reduce((n, r) => n + r.palabras, 0) + preambuloDe(elementos).palabras;
  const b = balanceDe(raices);
  const menor = b && raices.length > 0 ? Math.min(...raices.map((r) => r.palabras)) : 0;
  const fasesQueFaltan = faltasApa7(raices, fasesRequeridas, vocabulario)
    .filter((f) => f.clase === 'fase-requerida')
    .map((f) => f.detalle.replace(/^Falta la fase /, '').split(':')[0].trim());
  return {
    palabras,
    balance: b ? (menor / Math.max(1, b.mayor)) * 100 : null,
    fasesQueFaltan,
    figurasSinLeyenda: sinLeyenda(elementos),
    referenciasNoCitadas: hallazgos.filter((h) => h.subtype === 'referencia_huerfana').length,
  };
}

/** Una celda del pulso: el número y su nombre. Nunca al revés. */
export interface CeldaPulso {
  nombre: string;
  valor: string;
  /** El detalle, cuando el número necesita contexto. */
  detalle?: string;
}

/**
 * Las cinco celdas, SIEMPRE en el mismo orden y siempre las cinco.
 *
 * El balance sin comparación no se omite: se dice. Una fila de cuatro en un
 * panel de cinco se lee como un dato que falta, y no como una medida que no
 * aplica.
 */
export function celdasDelPulso(pulso: Pulso): CeldaPulso[] {
  return [
    { nombre: 'Palabras', valor: miles(pulso.palabras) },
    {
      nombre: 'Balance',
      valor: pulso.balance === null ? '—' : `${Math.round(pulso.balance)} %`,
      detalle: pulso.balance === null ? 'No hay con qué comparar' : 'la rama más corta contra la más larga',
    },
    {
      nombre: 'Fases que faltan',
      valor: String(pulso.fasesQueFaltan.length),
      detalle: pulso.fasesQueFaltan.join(', ') || undefined,
    },
    { nombre: 'Figuras sin leyenda', valor: String(pulso.figurasSinLeyenda) },
    { nombre: 'Referencias sin citar', valor: String(pulso.referenciasNoCitadas) },
  ];
}

export interface PulsoDocumentoProps extends OpcionesPulso {
  elementos: readonly ElementModel[] | null;
}

export const PulsoDocumento: React.FC<PulsoDocumentoProps> = ({
  elementos,
  fasesRequeridas,
  hallazgos,
  faseConocida,
  vocabulario,
}) => {
  const pulso = useMemo(
    () =>
      pulsoDe(
        elementos ?? [],
        fasesRequeridas ?? [],
        hallazgos ?? [],
        faseConocida ?? {},
        vocabulario,
      ),
    [elementos, fasesRequeridas, hallazgos, faseConocida, vocabulario],
  );
  const celdas = celdasDelPulso(pulso);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
      <ul
        aria-label="Pulso del documento"
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          flex: '1 1 auto',
          flexWrap: 'wrap',
        }}
      >
        {celdas.map((c) => (
          <li
            key={c.nombre}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              flex: '1 1 140px',
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderTop: c.nombre === 'Palabras' ? '3px solid var(--color-accent)' : c.nombre === 'Balance' ? '3px solid var(--color-success)' : '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform var(--transition-fast)',
            }}
          >
            {/* EL VALOR ARRIBA Y EL NOMBRE ABAJO */}
            <span
              style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 700,
                lineHeight: 1.1,
                color: c.nombre === 'Palabras' ? 'var(--color-accent)' : 'var(--color-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {c.valor}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>{c.nombre}</span>
            {c.detalle && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-tertiary)',
                  maxWidth: '24ch',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={c.detalle}
              >
                {c.detalle}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PulsoDocumento;
