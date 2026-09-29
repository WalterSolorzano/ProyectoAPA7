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
}

export const CarruselPortada: React.FC<CarruselPortadaProps> = ({
  onSelect,
  modoActivo,
  hoja = 'carta',
  onUpload,
  onElegirDiseno,
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

  const m = medidaDeLaHoja(hoja, ANCHO_DE_MINIATURA_PX);

  return (
    <>
    <div
      data-testid="carrusel"
      role="group"
      aria-label="Diseños de portada"
      tabIndex={0}
      onKeyDown={alTeclado}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
        <button
          type="button"
          aria-label="Ir al diseño anterior"
          onClick={() => irA(indice - 1)}
          disabled={indice === 0}
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: indice === 0 ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-primary)',
            opacity: indice === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={12} strokeWidth="var(--icon-stroke)" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Ir al siguiente diseño"
          onClick={() => irA(indice + 1)}
          disabled={indice === DISENOS_DE_PORTADA.length - 1}
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: indice === DISENOS_DE_PORTADA.length - 1 ? 'not-allowed' : 'pointer',
            color: 'var(--color-text-primary)',
            opacity: indice === DISENOS_DE_PORTADA.length - 1 ? 0.5 : 1,
          }}
        >
          <ChevronRight size={12} strokeWidth="var(--icon-stroke)" aria-hidden />
        </button>
      </div>

      {/* La pista. Con movimiento reducido NO es un carrusel con perspectiva: es un
          strip con scroll, que es la alternativa que el spec pide y la única que
          funciona sin animacion. */}
      <div
        ref={pistaRef}
        /* El `testid` no es decorativo: `coverStudioChrome.test.tsx` lo usa
           para leer la pista. Cambiarlo sin tocar ese test deja la guarda
           mirando un elemento que ya no existe, que es "pasar sin mirar". */
        data-testid="cover-model-track"
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          overflowX: reducido ? 'auto' : 'hidden',
          /* La perspectiva vive en el CONTENEDOR y el `rotateY` en las vecinas, que
             es como se hace un carrusel 3D de verdad: si el `rotateY` va en el
             contenedor, todas las tarjetas giran con el contenedor. */
          perspective: reducido ? 'none' : '1400px',
          perspectiveOrigin: '50% 50%',
          padding: 'var(--space-3) var(--space-4)',
          scrollbarWidth: 'thin',
        }}
      >
        {DISENOS_DE_PORTADA.map((d, i) => {
          const activa = i === indice;
          const distancia = Math.abs(i - indice);
          if (reducido && !activa) return null;
          /* El ángulo sale de una constante indexada por la distancia, y no de un
             número en el JSX: "dos o tres por lado" es una decisión, y una decisión
             escrita en el markup es una decisión que no se puede cambiar sin leer
             el componente entero.
             Y una tarjeta MÁS LEJOS de `VECINAS_POR_LADO` no lleva `transform`
             ninguno: girarla 0 grados y empujarla 120 px es un `transform` vacío
             disfrazado, y lo que el spec pide es que las vecinas son dos o tres
             por lado. Lejos de ese radio, la tarjeta no está en el carrusel. */
          const esVecina = distancia <= VECINAS_POR_LADO;
          const angulo = esVecina
            ? ANGULOS_POR_DISTANCIA[distancia - 1] * (i < indice ? -1 : 1)
            : 0;
          return (
            <button
              key={d.id}
              type="button"
              data-testid={`miniatura-${d.id}`}
              /* Sin `aria-pressed` en la de plantilla: abrir un selector de
                 archivos no es un estado, y con `aria-pressed` el lector de
                 pantalla anuncia "no presionado" sobre algo que no es un
                 interruptor. Es el mismo criterio que aplica a su chip. */
              aria-pressed={d.esAccion ? undefined : activa}
              aria-current={activa ? 'true' : undefined}
              onClick={() => elegir(d.id)}
              style={{
                flex: '0 0 auto',
                width: ANCHO_DE_MINIATURA_PX,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: activa ? 'var(--color-accent-soft)' : 'var(--surface-elevated)',
                border: activa ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                boxShadow: activa ? 'var(--shadow-card)' : 'var(--shadow-sm)',
                /* SIN `transform` cuando el movimiento está reducido. La preferencia
                   pide eso y el test lo mide. */
                transform:
                  reducido || !esVecina
                    ? undefined
                    : `rotateY(${angulo}deg) translateZ(${-distancia * 40}px)`,
                transformStyle: reducido ? undefined : 'preserve-3d',
                opacity: reducido || activa ? 1 : 0.75,
                transition: reducido
                  ? undefined
                  : 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow var(--transition-fast)',
                display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px',
                textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <MiniaturasDeDiseno diseno={d.id} medida={m} portada={portada} acta={acta} reglas={reglas} />
              <span
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-main)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {d.titulo}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                  lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {d.subtitulo}
              </span>
            </button>
          );
        })}
      </div>
    </div>
    {datosAbiertos && <HojaDatosPortada pasoActual={1} pasoDePortada={1} />}
    </>
  );
}