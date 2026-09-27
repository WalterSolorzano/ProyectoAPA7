/**
 * WordAPA7 — T18: la pantalla de portada entra al chrome del workbench: una
 * tira de 44px con las estrategias arriba, el carrusel con la vista previa al
 * centro y el editor de portada a 320px a la derecha.
 *
 * Lo que este archivo protege, en orden de importancia:
 *
 *  1. La tira lista las CINCO estrategias REALES del componente —las de `cards`:
 *     original, APA 7, UNI, Pro y la de subir plantilla—, no una lista
 *     inventada. Un chip de más es un modo que no se puede elegir; uno de menos
 *     es un modo inalcanzable, que es el mismo defecto que un filtro que se
 *     reduce a un solo chip.
 *  2. Tira y carrusel eligen LO MISMO: son dos controles del mismo estado
 *     derivado de `portada`, y el chip tiene que seguir a la tarjeta.
 *  3. El editor de 320px es `CoverEditorPanel` de verdad, no una caja vacía con
 *     el ancho correcto.
 *  4. La portada sigue siendo INDIVISIBLE: el lienzo no queda dentro de un
 *     contenedor con scroll propio que lo vuelva a medir, y la vista previa
 *     vive en una caja ACOTADA (`flex: 1` + `minHeight: 0`), no en una que
 *     crece con la hoja.
 *
 * `PaperCanvas` va simulado (como en T16) porque no hace falta la hoja real para
 * probar el chrome, y porque medirse a sí mismo en jsdom no significa nada.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { defaultPortada } from '../store/slices/coverSlice';
import { CoverCarouselStudio } from '../components/wizard/CoverCarouselStudio';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

vi.mock('../components/layout/PaperCanvas', () => ({
  PaperCanvas: () => <div data-testid="canvas" />,
}));

/* ── Utilidades ───────────────────────────────────────────────────────────── */

const portada = (over: Record<string, unknown> = {}) => {
  useDocStore.setState({
    portada: { ...defaultPortada, ...over },
    doc: null,
    wizardStep: 1,
  } as never);
};

const estado = () => useDocStore.getState().portada as unknown as Record<string, unknown>;

/** La tira: la barra de 44px. El grupo de estrategias es lo único de arriba
 *  que son chips: la barra lleva además la salida del paso. */
const grupo = (): HTMLElement => screen.getByRole('group', { name: 'Estrategias de portada' });
const tira = (): HTMLElement => grupo().closest('div[style*="height: 44px"]') as HTMLElement;
const chips = (): HTMLElement[] => within(grupo()).getAllByRole('button');
const chip = (nombre: string | RegExp): HTMLElement => within(grupo()).getByRole('button', { name: nombre });

/* Las CINCO estrategias del componente, con el rótulo que las nombra. */
const ESTRATEGIAS = [
  'Conservar original',
  'APA 7 Estándar',
  'Institucional UNI',
  'Profesional APA',
  '+ Subir plantilla',
];

/* ── Lectura del archivo ──────────────────────────────────────────────────── */

let TIRA = '';
let declarados = new Set<string>();
/** Lo que se busca es un color en un ESTILO, no en un comentario. */
const codigo = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

beforeAll(async () => {
  // Las flechas del carrusel llaman a scrollBy, que jsdom no trae.
  if (!Element.prototype.scrollBy) {
    Element.prototype.scrollBy = function () {};
  }
  /* El nombre va en una variable: con el literal, `nodePolyfills()` de vite lo
     resuelve a su propio shim y `readFileSync` no existe. */
  const NODE_FS = 'node:fs';
  const NODE_PATH = 'node:path';
  const NODE_URL = 'node:url';
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  const src = readFileSync(resolve(testDir, '../components/wizard/CoverCarouselStudio.tsx'), 'utf8');
  /* La región del chrome nuevo va ACOTADA por sus dos marcadores —la lista de
     estrategias y el componente que la usa—, y el test que la mira exige que los
     dos sigan ahí: sin esa comprobación, un archivo reordenado devolvería una
     cadena vacía y esas pruebas pasarían sin mirar nada. */
  const desde = src.indexOf('const COVER_CARDS');
  const hasta = src.indexOf('export const CoverCarouselStudio');
  TIRA = desde > -1 && hasta > desde ? src.slice(desde, hasta) : '';
  const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
  declarados = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
});

/* ── La tira de estrategias ───────────────────────────────────────────────── */

describe('T18 — la tira lista las estrategias que la app tiene', () => {
  it('la tira es la primera zona y mide 44px', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    expect(raiz.children[0]).toBe(tira());
    expect(tira().style.height).toBe('44px');
    // `flexShrink` es un número sin unidad: jsdom lo serializa '0'.
    expect(tira().style.flexShrink).toBe('0');
  });

  it('un chip por estrategia real, y ninguno de más', () => {
    portada();
    render(<CoverCarouselStudio />);
    // La cuenta sale de los chips: si `COVER_CARDS` crece y la tira no, el modo
    // nuevo queda solo en el carrusel, y si la tira inventa uno, el chip no hace
    // nada.
    expect(chips().map((c) => (c.textContent || '').trim())).toEqual(ESTRATEGIAS);
  });

  it('el chip encendido es el modo derivado del documento, no un estado propio', () => {
    portada({ use_original_cover: false, cover_mode: 'generate_uni_cover' });
    render(<CoverCarouselStudio />);
    expect(chip('Institucional UNI').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Conservar original').getAttribute('aria-pressed')).toBe('false');
  });

  it('una plantilla ya cargada enciende su chip, y los otros cuatro siguen ahí', () => {
    // Un documento con `cover_template_id` NO es un modo que la app no conozca:
    // es el modo 'custom'. Si la tira lo perdiera, la persona no tendría cómo
    // volver a su plantilla ni a ver cuál tiene puesta.
    portada({ use_original_cover: false, cover_mode: '', cover_template_id: 'custom-7' });
    render(<CoverCarouselStudio />);
    expect(chip('+ Subir plantilla').getAttribute('aria-pressed')).toBe('true');
    expect(chips().map((c) => (c.textContent || '').trim())).toEqual(ESTRATEGIAS);
  });

  it('elegir un chip cambia la portada del documento', () => {
    portada();
    render(<CoverCarouselStudio />);
    fireEvent.click(chip('Institucional UNI'));
    expect(estado().cover_mode).toBe('generate_uni_cover');
    expect(estado().use_original_cover).toBe(false);
    // Y el chip se enciende solo: la tira no guarda el modo, lo deriva.
    expect(chip('Institucional UNI').getAttribute('aria-pressed')).toBe('true');
  });

  it('el chip de plantilla abre el selector de archivos en vez de elegir un modo', () => {
    // "Subir plantilla" no es un modo más: es una acción. Si el chip lo
    // tratara como los demás pondría `cover_template_id` sin que haya una
    // plantilla detrás, y el documento declararía una portada que no existe.
    portada();
    const abierto = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<CoverCarouselStudio />);
    fireEvent.click(chip('+ Subir plantilla'));
    expect(abierto).toHaveBeenCalled();
    expect(estado().cover_template_id).toBeUndefined();
    abierto.mockRestore();
  });
});

/* ── La tira y el carrusel son el mismo control ───────────────────────────── */

describe('T18 — tira y carrusel no cuentan historias distintas', () => {
  it('elegir en la tarjeta enciende el chip de la tira', () => {
    portada();
    render(<CoverCarouselStudio />);
    const pista = screen.getByTestId('cover-model-track');
    fireEvent.click(within(pista).getByText('Profesional APA'));
    expect(chip('Profesional APA').getAttribute('aria-pressed')).toBe('true');
    expect(estado().cover_mode).toBe('apa_pro');
  });

  it('la pista y la tira ofrecen las mismas cinco estrategias', () => {
    portada();
    render(<CoverCarouselStudio />);
    const pista = screen.getByTestId('cover-model-track');
    /* Una tarjeta por estrategia, con el rótulo que la nombra. Si la pista
       tuviera una tarjeta que la tira no lista, ese modo no se podría elegir
       desde la barra; y al revés, un chip sin tarjeta no tendría miniatura. */
    expect(pista.querySelectorAll(':scope > div')).toHaveLength(ESTRATEGIAS.length);
    for (const titulo of ESTRATEGIAS) {
      expect(within(pista).getByText(titulo, { selector: 'span' })).toBeTruthy();
    }
  });
});

/* ── Las tres zonas ───────────────────────────────────────────────────────── */

describe('T18 — el editor vive a la derecha, en 320px', () => {
  it('el panel de 320px es el editor de verdad y no una caja con el ancho bien', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const panel = container.querySelector('[data-testid="cover-editor"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.width).toBe('320px');
    // Un `flex: 1` encima del ancho lo borraría en cuanto la ventana creciera.
    expect(panel.style.flexShrink).toBe('0');
    expect(within(panel).getByText('Editor de portada')).toBeTruthy();
  });

  it('el editor es la última zona y el carrusel la primera de la fila', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    const fila = raiz.children[1] as HTMLElement;
    expect(fila.children[0]).toBe(screen.getByTestId('cover-carousel'));
    expect(fila.children[fila.children.length - 1]).toBe(
      container.querySelector('[data-testid="cover-editor"]')
    );
  });

  it('el carrusel y su vista previa comparten la columna del centro', () => {
    portada();
    render(<CoverCarouselStudio />);
    const centro = screen.getByTestId('cover-carousel');
    expect(centro.contains(screen.getByTestId('cover-model-track'))).toBe(true);
    expect(centro.contains(screen.getByTestId('canvas'))).toBe(true);
  });
});

/* ── La portada no se mide dos veces ──────────────────────────────────────── */

describe('T18 — la portada sigue siendo un bloque que no se parte', () => {
  it('el lienzo no queda dentro de un contenedor que lo vuelva a medir', () => {
    /* El aviso de T18: si la columna del centro trae `overflow: auto`, el
       lienzo se mide contra una caja que crece con la hoja y la paginación deja
       de decidir nada. `computePages` agrupa la portada en la página 1 como un
       bloque, y esa regla solo vale si nadie mide el lienzo por su cuenta. */
    portada();
    const { container } = render(<CoverCarouselStudio />);
    const raiz = container.firstElementChild as HTMLElement;
    const cadena: HTMLElement[] = [];
    for (let n = screen.getByTestId('canvas').parentElement; n && n !== raiz; n = n.parentElement) {
      cadena.push(n);
    }
    expect(cadena.length).toBeGreaterThan(0);
    for (const n of cadena) {
      expect(`${n.style.overflow} ${n.style.overflowY} ${n.style.overflowX}`).not.toMatch(/auto|scroll/);
    }
    expect(raiz.style.overflow).toBe('hidden');
  });

  it('la vista previa tiene una caja acotada por el alto, no la que le da la hoja', () => {
    portada();
    render(<CoverCarouselStudio />);
    const centro = screen.getByTestId('cover-carousel');
    const vista = screen.getByTestId('canvas').parentElement as HTMLElement;
    // El centro es columna: la pista de arriba no puede empujar al lienzo.
    expect(centro.style.display).toBe('flex');
    expect(centro.style.flexDirection).toBe('column');
    expect(centro.style.minHeight).toBe('0px');
    // Y el preview crece hasta llenar lo que queda, con `minHeight: 0` para que
    // pueda encogerse: sin esto el `flex: 1` de abajo no manda.
    expect(vista.style.flex).not.toBe('');
    expect(vista.style.minHeight).toBe('0px');
  });
});

/* ── Tokens y copy del chrome que escribió esta task ──────────────────────── */

describe('T18 — el chrome nuevo usa tokens declarados', () => {
  it('el chrome nuevo no lleva colores literales ni radios fuera de token', () => {
    // El archivo arrastra estilos viejos que esta task no tocó (las miniaturas
    // esqueleto); la comprobación va ACOTADA a la región que este commit
    // escribió: la lista de estrategias, el estilo de chip y la tira.
    expect(TIRA).toContain('Estrategias de portada');
    expect(codigo(TIRA)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo(TIRA)).not.toMatch(/rgba?\(/);
    const radios = [...codigo(TIRA).matchAll(/borderRadius:\s*'([^']+)'/g)].map((m) => m[1]);
    // Sin radios la comprobación de abajo no miraría nada.
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) expect(radio).toMatch(/^var\(--radius-/);
  });

  it('cada token que usa el chrome nuevo está declarado en design-system.css', () => {
    const usados = new Set<string>();
    for (const m of codigo(TIRA).matchAll(/var\(\s*(--[a-z0-9-]+)/g)) usados.add(m[1]);
    expect(usados.size).toBeGreaterThan(0);
    for (const token of usados) {
      expect(declarados.has(token), `${token} no esta declarado`).toBe(true);
    }
  });

  it('ninguna cadena de la vista lleva emojis', () => {
    portada();
    const { container } = render(<CoverCarouselStudio />);
    expect(container.textContent || '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('el texto de la pantalla sigue siendo el que el paso necesita', () => {
    // La salida del paso no es chrome decorativo: si desaparece al rearmar la
    // barra, el paso 1 deja de avanzar. Se busca DENTRO de la tira porque el
    // editor de la derecha tiene su propio "Continuar a Estructura".
    portada();
    render(<CoverCarouselStudio />);
    expect(within(tira()).getByRole('button', { name: /Continuar/ })).toBeTruthy();
  });
});

