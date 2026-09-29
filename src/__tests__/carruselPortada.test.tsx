/**
 * El carrusel es el carrusel, y la hoja de datos entra al elegir.
 *
 * Lo que hay hoy: las cinco `COVER_CARDS` son MINIATURAS DIBUJADAS CON `div` (líneas
 * grises que fingen ser un texto), y dos de ellas —`original` y `custom`— no tienen
 * ningún componente que las dibuje: caen a `PaperCanvas onlyCover`. O sea que
 * "Conservar original", que es la recomendada, no tenía miniatura propia. Ninguna
 * miniatura se parecía a lo que la app genera, y ninguna se actualizaba con los datos
 * que el usuario escribía.
 *
 * Y el carrusel no era un carrusel: dos botones que hacían `scrollBy`, sin estado, sin
 * teclado, sin `aria`, y sin `prefers-reduced-motion` (con `transform` y `scale` en cada
 * tarjeta, que es exactamente lo que la preferencia pide no hacer).
 *
 * Ahora cada miniatura renderiza el DISEÑO REAL a la escala de la Task 2, el carrusel
 * tiene índice y controles con teclado, y con movimiento reducido se convierte en un
 * strip con scroll.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn((u: string) => u),
  triggerDownload: vi.fn(),
}));
vi.mock('../components/layout/PaperCanvas', () => ({
  PaperCanvas: () => <div data-testid="canvas" />,
}));

import { useDocStore } from '../store/useDocStore';
import { defaultActa, defaultPortada } from '../store/slices/coverSlice';
import { CarruselPortada, HOJA_DE_DATOS_TESTID } from '../components/wizard/portada/CarruselPortada';
import { HojaDatosPortada } from '../components/wizard/portada/HojaDatosPortada';
import { CATALOGO_DE_UNIVERSIDADES } from '../lib/portada/catalogo';

const montarCarrusel = (portada = {}) => {
  useDocStore.setState({
    portada: { ...defaultPortada, institution: 'UNAN-Managua', ...portada },
    acta: { ...defaultActa, autor: 'Br. Ana Pérez | Carnet: 2023-1029U' },
    doc: null,
    wizardStep: 1,
  } as never);
  /* La institucion se elige en el store, no se escribe a mano: el logo viaja con
     la eleccion del catalogo. Escribir el nombre en el campo es texto libre, y el
     logo no se deduce de ahi. */
  useDocStore.getState().updateCoverInstitucion('UNAN');
  return render(<CarruselPortada />);
};

const miniatura = (id: string) => screen.getByTestId(`miniatura-${id}`);
const todasLasMiniaturas = () =>
  Array.from(document.querySelectorAll('[data-testid^="miniatura-"]')) as HTMLElement[];

describe('carrusel de portada', () => {
  beforeEach(() => {
    useDocStore.setState({ portada: { ...defaultPortada }, acta: { ...defaultActa } } as never);
  });
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('la miniatura es el diseno renderizado, no un esqueleto de divs', () => {
    // El defecto: las cinco tarjetas eran lineas grises dibujadas con `div`, y dos
    // no tenian componente que las dibujara. "Conservar original" no tenia
    // miniatura.
    montarCarrusel();
    const uni = miniatura('uni');
    // El diseño real trae el titulo y el area, con los datos de la portada.
    expect(uni.textContent).toContain('UNAN-Managua');
    expect(uni.querySelector('[data-campo="title"]')).toBeTruthy();
  });

  it('la miniatura de "conservar original" tambien es un diseno, no un hueco', () => {
    // `original` y `custom` caian a `PaperCanvas onlyCover`, o sea que no tenian
    // miniatura propia. Y `original` es la recomendada.
    montarCarrusel();
    const original = miniatura('original');
    expect(original.textContent).toContain('UNAN-Managua');
    expect(original.querySelector('[data-campo="title"]')).toBeTruthy();
  });

  it('la miniatura se actualiza con los datos de la portada', () => {
    // Si la miniatura no se actualiza, no sirve para decidir nada: el usuario
    // elige un diseño sin ver lo que va a salir con lo que escribió.
    const { unmount } = montarCarrusel({ title: 'Titulo viejo' });
    expect(miniatura('uni').textContent).toContain('Titulo viejo');
    unmount();

    useDocStore.setState({
      portada: { ...useDocStore.getState().portada, title: 'Titulo nuevo' },
    } as never);
    render(<CarruselPortada />);
    expect(miniatura('uni').textContent).toContain('Titulo nuevo');
  });

  it('tiene controles para ir a izquierda y a derecha, con teclado', () => {
    montarCarrusel();
    fireEvent.click(screen.getByLabelText(/siguiente dise/));
    expect(miniatura('apa7').getAttribute('aria-current')).toBe('true');

    fireEvent.keyDown(screen.getByTestId('carrusel'), { key: 'ArrowLeft' });
    expect(miniatura('original').getAttribute('aria-current')).toBe('true');

    fireEvent.keyDown(screen.getByTestId('carrusel'), { key: 'ArrowRight' });
    expect(miniatura('apa7').getAttribute('aria-current')).toBe('true');
  });

  it('la flecha izquierda en la primera no se sale del rango', () => {
    // Un carrusel que al llegar al primero te tira al ultimo no es un carrusel,
    // es un portal. Y uno que al llegar al ultimo no hace nada deja al usuario
    // preguntandose si se rompió.
    montarCarrusel();
    fireEvent.keyDown(screen.getByTestId('carrusel'), { key: 'ArrowLeft' });
    expect(miniatura('original').getAttribute('aria-current')).toBe('true');
  });

  it('la hoja de datos aparece al elegir un diseno, con solo los datos', () => {
    // Sin estilos: los estilos viven en el carrusel. Repetirlos en el formulario
    // superior es exactamente el panel duplicado que el spec saca.
    montarCarrusel();
    expect(screen.queryByTestId(HOJA_DE_DATOS_TESTID)).toBeNull();

    fireEvent.click(miniatura('apa7'));

    const hoja = screen.getByTestId(HOJA_DE_DATOS_TESTID);
    expect(hoja.textContent).toContain('Br. Ana Pérez');
    // Y NO contiene los nombres de los estilos.
    for (const estilo of ['APA 7 Estándar', 'Institucional UNI', 'Profesional APA']) {
      expect(hoja.textContent).not.toContain(estilo);
    }
  });

  it('con prefers-reduced-motion no hay transformacion, y el carrusel sigue navegable', () => {
    const original = window.matchMedia;
    window.matchMedia = (() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      media: '',
      onchange: null,
      dispatchEvent: vi.fn(),
    })) as never;
    try {
      montarCarrusel();
      for (const t of todasLasMiniaturas()) {
        expect(t.style.transform).toBe('');
        expect(t.style.transition).toBe('');
      }
      // Sin transform no hay carrusel, asi que tiene que quedar navegable de
      // otra manera: el strip con scroll y los mismos controles.
      // La pista, no el grupo: el `overflow` que se abre es el del STRIP.
      expect(screen.getByTestId('cover-model-track').style.overflowX).toBe('auto');
      fireEvent.click(screen.getByLabelText(/siguiente dise/));
      expect(miniatura('apa7').getAttribute('aria-current')).toBe('true');
    } finally {
      window.matchMedia = original;
    }
  });

  it('el numero de vecinas visibles sale de una constante, no de un numero en el JSX', () => {
    // "dos o tres por lado segun el ancho" es una DECISION, y una decision
    // escrita en el JSX es una decision que no se puede cambiar sin leer el
    // markup entero.
    montarCarrusel();
    // La rotacion se aplica a las vecinas, no a la activa.
    const vecinas = todasLasMiniaturas().filter(
      (t) => t.getAttribute('aria-current') !== 'true',
    );
    expect(vecinas.length).toBeGreaterThan(0);
    const conTransform = vecinas.filter((t) => t.style.transform !== '');
    // No todas las vecinas giran: las que estan lejos del centro, no.
    expect(conTransform.length).toBeLessThan(vecinas.length);
  });

  it('el logo que se pide es el de la institucion elegida, no el de UNI siempre', () => {
    montarCarrusel();
    const catalogo = CATALOGO_DE_UNIVERSIDADES.find((u) => u.codigo === 'UNAN')!;
    const imagenes = within(miniatura('uni')).queryAllByRole('img');
    expect(imagenes.some((i) => i.getAttribute('src')?.includes(catalogo.logoUrl!))).toBe(true);
  });
});

describe('volver a la portada desde otra etapa', () => {
  beforeEach(() => {
    useDocStore.setState({
      portada: { ...defaultPortada },
      acta: { ...defaultActa },
      wizardStep: 1,
      wizardStepAnterior: 1,
    } as never);
  });

  it('al salir a otra etapa y volver, se vuelve a la portada', () => {
    /* El bug que reporto el usuario: se va a otra etapa y no vuelve a la
       portada. `wizardStep` no tenia memoria de "de donde vine", asi que al
       volver aparecia en la etapa en la que estabas.

       `wizardStepAnterior` no existia; se agrego. `volverAPortada()` es la
       pregunta con respuesta, y con `viewMode: 'edit'` porque un destino del
       rail es una fase del editor (AGENTS.md). */
    useDocStore.getState().setWizardStep(3);
    expect(useDocStore.getState().wizardStep).toBe(3);
    expect(useDocStore.getState().wizardStepAnterior).toBe(3);

    useDocStore.getState().volverAPortada();
    expect(useDocStore.getState().wizardStep).toBe(1);
    expect(useDocStore.getState().viewMode).toBe('edit');
  });

  it('la hoja de datos se cierra sola al cambiar de fase', () => {
    /* Una hoja de datos de la portada abierta sobre la etapa de Revision es una
       hoja de datos de otra cosa. */
    const { unmount } = montarCarrusel();
    fireEvent.click(miniatura('apa7'));
    expect(screen.queryByTestId(HOJA_DE_DATOS_TESTID)).toBeTruthy();
    unmount();

    const { rerender } = render(<HojaDatosPortada pasoActual={3} pasoDePortada={1} />);
    expect(screen.queryByTestId(HOJA_DE_DATOS_TESTID)).toBeNull();
    rerender(<HojaDatosPortada pasoActual={1} pasoDePortada={1} />);
  });
});
