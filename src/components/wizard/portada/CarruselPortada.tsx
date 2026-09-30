/**
 * WordAPA7 — el carrusel de portada.
 *
 * Lo que hay en `CoverCarouselStudio.tsx` NO es un carrusel: son cinco tarjetas con
 * miniaturas dibujadas a mano con `div` (líneas grises que fingen ser un texto), dos
 * botones que hacen `scrollBy`, sin índice, sin teclado, sin `aria`, y con `transform`
 * y `scale` en cada tarjeta sin mirar `prefers-reduced-motion`.
 *
 * Y dos de las cinco no tenían ni componente que las dibujara: `original` y `custom`
 * caían a `PaperCanvas onlyCover`. O sea que "Conservar original", que es la
 * recomendada, no tenía miniatura propia.
 *
 * Acá:
 *   - Cada miniatura renderiza el DISEÑO REAL, a la escala de `lib/portada/geometria`,
 *     con los datos de la portada. Si una miniatura no se parece a lo que sale, es
 *     porque el diseño está mal, y ahora se ve antes de exportar.
 *   - El carrusel tiene ÍNDICE, así que hay una sola fuente de verdad de "cuál está
 *     activa" y la tira de estrategias puede leerla.
 *   - Controles con botón, con flechas y con `aria`. Sin los tres no es un carrusel.
 *   - `prefers-reduced-motion: reduce` → sin `transform`, sin `transition`, y el
 *     carrusel se vuelve un strip con scroll. Un carrusel que no se puede usar sin
 *     movimiento no es un carrusel.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDocStore } from '../../../store/useDocStore';
import { medidaDeLaHoja, type Hoja } from '../../../lib/portada/geometria';
import { MiniaturasDeDiseno, type DisenoDePortada } from './MiniaturasDeDiseno';
import { HojaDatosPortada, HOJA_DE_DATOS_TESTID } from './HojaDatosPortada';
import { EditorialMascot, type MascotKind, type MascotExpression } from '../../layout/EditorialMascot';

function obtenerMascotaDePortada(disenoId: string): {
  kind: MascotKind;
  expression: MascotExpression;
  mensaje: string;
} {
  switch (disenoId) {
    case 'original':
      return {
        kind: 'reference',
        expression: 'happy',
        mensaje: 'Protegiendo logos y formato original del documento',
      };
    case 'apa7':
      return {
        kind: 'highlighter',
        expression: 'excited',
        mensaje: 'Formato oficial APA 7 para entregas académicas',
      };
    case 'uni':
      return {
        kind: 'ruler',
        expression: 'curious',
        mensaje: 'Estructura universitaria institucional oficial',
      };
    case 'pro':
      return {
        kind: 'gear',
        expression: 'happy',
        mensaje: 'Portada profesional con titulación corrida y numeración',
      };
    case 'custom':
      return {
        kind: 'highlighter',
        expression: 'curious',
        mensaje: 'Importa tu propia plantilla Word (.docx)',
      };
    default:
      return {
        kind: 'reference',
        expression: 'neutral',
        mensaje: 'Selecciona un estilo de portada',
      };
  }
}

/** Los cinco modos, con el componente que los dibuja de verdad.
 *
 *  Antes la lista vivía en `CoverCarouselStudio.tsx` como un `icon` y un par de
 *  textos, sin ningún render. Ahora el `render` es parte del dato: si un modo no tiene
 *  componente, no puede entrar en la lista, y no puede pasar lo de `original`, que se
 *  caía a un placeholder.
 */
export const DISENOS_DE_PORTADA: DisenoDePortada[] = [
  { id: 'original', titulo: 'Conservar original', subtitulo: 'Mantiene logos y diseño · recomendado' },
  { id: 'apa7', titulo: 'APA 7 Estándar', subtitulo: 'Formato oficial 7ª edición' },
  { id: 'uni', titulo: 'Institucional UNI', subtitulo: 'Plantilla oficial universitaria' },
  { id: 'pro', titulo: 'Profesional APA', subtitulo: 'Con running head y página' },
  { id: 'custom', titulo: '+ Subir plantilla', subtitulo: 'Sube tu propia plantilla .docx', esAccion: true },
];

/** Cuántas tarjetas se ven a cada lado de la activa.
 *
 *  Sale de AQUÍ y no de un número escrito en el JSX. Con la tarjeta de 224px y un
 *  ancho de pantalla cualquiera, dos por lado es lo que entra sin que la activa
 *  quede pegada al borde. */
export const VECINAS_POR_LADO = 2;

export { HOJA_DE_DATOS_TESTID };

/** Ancho de la miniatura. Sale de la medida, no de un número: la miniatura es la
 *  hoja real a menos escala. */
const ANCHO_DE_MINIATURA_PX = 224;

/** Lee `prefers-reduced-motion` y se suscribe a sus cambios.
 *
 *  `matchMedia` no es una API con garantía: no existe en los WebViews viejos y el
 *  propio repo ya tiene un test de eso. Por eso la guarda de existencia. */
function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    /* El listener no recibe el evento a propósito: se lee `mq.matches` en el
       momento del cambio. Safari viejo llama al callback con CERO argumentos, así
       que un `(e) => setReducido(e.matches)` revienta ahí con "cannot read
       property matches of undefined". */
    const alCambiar = () => setReducido(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', alCambiar);
      return () => mq.removeEventListener('change', alCambiar);
    }
    // Safari viejo y los WebViews: `addListener`, no `addEventListener`.
    const viejo = mq as unknown as { addListener?: (f: () => void) => void; removeListener?: (f: () => void) => void };
    viejo.addListener?.(alCambiar);
    return () => viejo.removeListener?.(alCambiar);
  }, []);
  return reducido;
}

const ANGULOS_POR_DISTANCIA = [0, 34, 56];

export interface CarruselPortadaProps {
  /** Qué hacer con el modo que se elige. La lista de estrategias lo provee. */
  onSelect?: (id: string) => void;
  /** Cuál está activa. Sin esto el carrusel se desincroniza de la tira. */
  modoActivo?: string | null;
  hoja?: Hoja;
  /** Acción de la última tarjeta: abrir el selector de plantillas. */
  onUpload?: () => void;
  /** Si se elige un diseño, se muestra la hoja de datos. */
  onElegirDiseno?: (id: string) => void;
  /** Ancho personalizado para modo carrusel principal grande */
  anchoMiniatura?: number;
  /** Callback para confirmar y entrar al editor dividido */
  onConfirmSelect?: (id: string) => void;
}

export const CarruselPortada: React.FC<CarruselPortadaProps> = ({
  onSelect,
  modoActivo,
  hoja = 'carta',
  onUpload,
  onElegirDiseno,
  anchoMiniatura,
  onConfirmSelect,
}) => {
  const portada = useDocStore((s) => s.portada);
  const acta = useDocStore((s) => s.acta);
  const reglas = useDocStore((s) => s.rules);
  const reducido = useMovimientoReducido();
  const pistaRef = useRef<HTMLDivElement>(null);
  /* La hoja de datos aparece AL ELEGIR un diseno, y se cierra sola al cambiar
     de fase (esta en `HojaDatosPortada`). */
  const [datosAbiertos, setDatosAbiertos] = useState(false);

  const modo: string = modoActivo ?? '';
  const [indice, setIndice] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // El índice sigue al modo activo: si la tira de estrategias cambia el modo, el
  // carrusel tiene que estar en la misma tarjeta. Sin esto, dos controles
  // distintos dicen dos cosas distintas de la misma elección.
  useEffect(() => {
    const i = DISENOS_DE_PORTADA.findIndex((d) => d.id === modo);
    if (i >= 0) setIndice(i);
  }, [modo]);

  const irA = useCallback((destino: number) => {
    const total = DISENOS_DE_PORTADA.length;
    // El rango se acota en los dos extremos a propósito. Un carrusel que al
    // llegar al primero te tira al último es un portal, no un carrusel, y uno que
    // al llegar al último no hace nada deja al usuario preguntándose si se rompió.
    setIndice(Math.min(total - 1, Math.max(0, destino)));
  }, []);

  const alTeclado = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      irA(indice - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      irA(indice + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      irA(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      irA(DISENOS_DE_PORTADA.length - 1);
    }
  };

  const elegir = (id: string) => {
    if (DISENOS_DE_PORTADA.find((d) => d.id === id)?.esAccion) {
      onUpload?.();
      return;
    }
    onSelect?.(id);
    setDatosAbiertos(true);
    onElegirDiseno?.(id);
  };

  const anchoEfectivo = anchoMiniatura || ANCHO_DE_MINIATURA_PX;
  const m = medidaDeLaHoja(hoja, anchoEfectivo);
  const disenoActual = DISENOS_DE_PORTADA[indice] || DISENOS_DE_PORTADA[0];
  const mascotaActual = obtenerMascotaDePortada(disenoActual.id);

  return (
    <>
    <div
      data-testid="carrusel"
      role="group"
      aria-label="Diseños de portada"
      tabIndex={0}
      onKeyDown={alTeclado}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: '100%', alignItems: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', width: '100%', flexWrap: 'wrap' }}>
        {/* Mascota editorial con mensaje contextual */}
        <div
          data-testid="portada-mascota-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <EditorialMascot size={32} kind={mascotaActual.kind} expression={mascotaActual.expression} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {disenoActual.titulo}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
              {mascotaActual.mensaje}
            </span>
          </div>
        </div>

        {/* Controles de navegación */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            aria-label="Ir al diseño anterior"
            onClick={() => irA(indice - 1)}
            disabled={indice === 0}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: indice === 0 ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-primary)',
              opacity: indice === 0 ? 0.4 : 1,
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <ChevronLeft size={18} strokeWidth="var(--icon-stroke)" aria-hidden />
          </button>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {indice + 1} de {DISENOS_DE_PORTADA.length}
          </span>
          <button
            type="button"
            aria-label="Ir al siguiente diseño"
            onClick={() => irA(indice + 1)}
            disabled={indice === DISENOS_DE_PORTADA.length - 1}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: indice === DISENOS_DE_PORTADA.length - 1 ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-primary)',
              opacity: indice === DISENOS_DE_PORTADA.length - 1 ? 0.4 : 1,
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <ChevronRight size={18} strokeWidth="var(--icon-stroke)" aria-hidden />
          </button>
        </div>
      </div>

      {/* La pista 3D: portada activa destacada al frente y vecinas al fondo oscurecidas */}
      <div
        ref={pistaRef}
        data-testid="cover-model-track"
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          overflowX: reducido ? 'auto' : 'visible',
          justifyContent: 'center',
          alignItems: 'center',
          perspective: reducido ? 'none' : '1400px',
          perspectiveOrigin: '50% 50%',
          padding: 'var(--space-6) var(--space-6)',
          scrollbarWidth: 'thin',
          width: '100%',
          minHeight: '440px',
        }}
      >
        {DISENOS_DE_PORTADA.map((d, i) => {
          const activa = i === indice;
          const distancia = Math.abs(i - indice);
          if (reducido && !activa) return null;
          const esVecina = distancia <= VECINAS_POR_LADO;
          const isHovered = hoveredId === d.id && !activa;

          // La portada activa es super grande al frente; las del fondo van sin rotación,
          // escaladas menores en el eje Z y oscurecidas progresivamente.
          // El hover sobre las de fondo las acerca y aclara ligeramente con sutileza.
          const transformEstilo = reducido || !esVecina
            ? undefined
            : activa
              ? 'scale(1.22) translateZ(0px)'
              : isHovered
                ? `scale(${Math.max(0.78, 0.90 - (distancia - 1) * 0.08)}) translateZ(${-distancia * 80}px)`
                : `scale(${Math.max(0.74, 0.86 - (distancia - 1) * 0.08)}) translateZ(${-distancia * 130}px)`;

          const filtroEstilo = reducido || activa
            ? 'none'
            : isHovered
              ? 'brightness(0.85) contrast(0.98)'
              : `brightness(${Math.max(0.48, 0.68 - (distancia - 1) * 0.16)}) contrast(0.96)`;

          const opacidadEstilo = reducido || activa
            ? 1
            : isHovered
              ? 0.92
              : Math.max(0.5, 0.74 - (distancia - 1) * 0.18);

          return (
            <button
              key={d.id}
              type="button"
              data-testid={`miniatura-${d.id}`}
              aria-pressed={d.esAccion ? undefined : activa}
              aria-current={activa ? 'true' : undefined}
              onMouseEnter={() => setHoveredId(d.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                irA(i);
                elegir(d.id);
              }}
              style={{
                flex: '0 0 auto',
                width: anchoEfectivo,
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                background: activa ? 'var(--color-bg-surface)' : 'var(--surface-elevated)',
                border: activa
                  ? '2px solid var(--accent-primary)'
                  : isHovered
                    ? '1px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                boxShadow: activa
                  ? '0 24px 48px var(--shadow-card), 0 0 0 1px var(--accent-primary), 0 0 24px var(--color-accent-soft)'
                  : isHovered
                    ? '0 10px 24px var(--shadow-card), 0 0 0 1px var(--border-subtle)'
                    : 'var(--shadow-sm)',
                transform: transformEstilo,
                transformStyle: reducido ? undefined : 'preserve-3d',
                filter: filtroEstilo,
                opacity: opacidadEstilo,
                transition: reducido
                  ? undefined
                  : 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 240ms ease, opacity 240ms ease, box-shadow 250ms ease, border-color 200ms ease',
                display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px',
                textAlign: 'left', fontFamily: 'inherit',
                zIndex: activa ? 30 : isHovered ? 25 : Math.max(1, 20 - distancia * 5),
                position: 'relative',
              }}
            >
              <MiniaturasDeDiseno diseno={d.id} medida={m} portada={portada} acta={acta} reglas={reglas} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-main)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {d.titulo}
                  </span>
                  {activa && (
                    <EditorialMascot size={20} kind={mascotaActual.kind} expression={mascotaActual.expression} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                    lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {d.subtitulo}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Botón de Confirmación Principal / CTA en la vista del Carrusel */}
      {onConfirmSelect && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            data-testid="btn-seleccionar-portada-cta"
            onClick={() => {
              const actual = DISENOS_DE_PORTADA[indice];
              if (actual?.esAccion) {
                onUpload?.();
              } else {
                onConfirmSelect(actual?.id || 'original');
              }
            }}
            style={{
              padding: '12px 28px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--color-text-on-accent)',
              border: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px var(--shadow-card)',
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            <span>{DISENOS_DE_PORTADA[indice]?.esAccion ? 'Subir plantilla .docx' : 'Seleccionar esta portada'}</span>
            <ChevronRight size={16} strokeWidth="var(--icon-stroke)" aria-hidden />
          </button>
        </div>
      )}
    </div>
    {datosAbiertos && <HojaDatosPortada pasoActual={1} pasoDePortada={1} />}
    </>
  );
}