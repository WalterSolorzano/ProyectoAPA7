/**
 * WordAPA7 — T17: la pantalla final de exportacion es una sola columna a la
 * izquierda, en orden fijo: check, titulo, una linea, dos botones. Y esa
 * columna no repite nada de lo que el usuario acaba de revisar.
 *
 * La afirmacion central de este archivo es negativa ("no hay resumenes"), y
 * una prueba negativa solo vale si puede fallar. Por eso el texto visible de
 * la columna se compara contra la cadena EXACTA que debe verse, con un
 * documento que tiene 3 citas fantasma cargadas: cualquier recap que alguien
 * vuelva a colar (un conteo, un porcentaje, un "corregiste N cosas") rompe esa
 * igualdad. Y como el recap podria usar otras palabras, hay una segunda regla
 * mas general: en toda la columna el unico digito es el 7 de "APA 7".
 * La version del brief (un grep de tres frases) solo detectaba esas tres
 * frases literales, y una vista que los repitiera con otra redaccion pasaba.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ExportView } from '../components/export/ExportView';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));

/* Los tres hijos pesados solo se montan con la vista previa abierta; aqui no
   se prueba el lienzo ni el PDF, asi que se sustituyen. */
vi.mock('../components/layout/PaperCanvas', () => ({ PaperCanvas: () => <div data-testid="canvas" /> }));
vi.mock('../components/layout/ReactPDFPreview', () => ({ ReactPDFPreview: () => <div data-testid="pdf" /> }));
vi.mock('../components/export/QuickReferenceSearch', () => ({
  QuickReferenceSearch: () => <div data-testid="crossref" />,
}));

/* Specifier en variable + import dinamico: si Vite puede analizarlos los pasa
   por vite-plugin-node-polyfills, cuyos shims de browser no traen readFileSync
   (mismo truco que designTokens.test.ts y focusReadingCard.test.tsx). */
const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';
let SRC = '';
beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  SRC = readFileSync(resolve(testDir, '../components/export/ExportView.tsx'), 'utf8');
});

/* ── Lo que la columna final DEBE mostrar, y nada mas ── */
const TITULO = 'Documento listo';
const LINEA = 'Tu trabajo cumple con el formato APA 7. Puedes descargarlo o convertir otro archivo.';
const TEXTO_ESPERADO = `${TITULO}${LINEA}Descargar documentoConvertir otroOpciones`;

/* Un documento con hallazgos de sobra: si la vista final los repitiera,
   estos datos serian justo lo que feedearia el recap que no debe existir. */
const TRES_CITAS_FANTASMA = {
  ghost_citations: [
    { marker: '(Smith, 2019)', page: 4 },
    { marker: '(Jones et al., 2020)', page: 9 },
    { marker: '(Lee, 2021)', page: 15 },
  ],
};

const cargar = (extra: Record<string, unknown> = {}) => {
  useDocStore.setState({
    doc: {
      session_id: 's-t17',
      file_name: 'Tesis.docx',
      elements: [],
      referencias: [],
      meta: { page_count: 12 },
    } as never,
    isLoading: false,
    atHome: false,
    citationAuditResult: null,
    exportDocx: vi.fn(),
    exportPdf: vi.fn(),
    exportLatex: vi.fn(),
    clearQuickExport: vi.fn(),
    copyPdfToClipboard: vi.fn(),
    ...extra,
  });
};

const columna = () => screen.getByLabelText('Exportación lista para descargar');

describe('T17 — ExportView: la columna final', () => {
  beforeEach(() => cargar());

  it('respeta el orden fijo: check, título, una línea y los dos botones pegados', () => {
    render(<ExportView />);

    /* svg del check, h1 del titulo, p de la linea, div de los botones.
       El quinto hijo es el toggle fantasma de Opciones: sin el, el formato y
       la vista previa quedan inalcanzables. */
    const hijos = Array.from(columna().children).map((el) => el.tagName.toLowerCase());
    expect(hijos).toEqual(['svg', 'h1', 'p', 'div', 'button']);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(TITULO);

    const linea = screen.getByText(LINEA);
    expect(linea.tagName).toBe('P');
    expect(linea.style.maxWidth).toBe('50ch');

    const fila = columna().children[3];
    const botones = Array.from(fila.querySelectorAll('button')).map((b) => b.textContent);
    expect(botones).toEqual(['Descargar documento', 'Convertir otro']);
  });

  it('no repite hallazgos ni estadísticas, ni aunque el documento los tenga', () => {
    /* Con 3 citas fantasma sin resolver y 12 paginas en el store: los numeros
       existen, la columna final no los menciona. */
    cargar({ citationAuditResult: TRES_CITAS_FANTASMA });
    render(<ExportView />);

    expect(columna().textContent).toBe(TEXTO_ESPERADO);

    /* Y la regla que no depende de la cadena exacta: el unico digito que se
       ve en toda la columna es el 7 de "APA 7". Ningun conteo, ninguna
       pagina, ningun porcentaje. */
    const digitos = columna().textContent!.match(/\d/g);
    expect(digitos).toEqual(['7']);
  });

  it('no trae listas, tarjetas ni columnas en el estado por defecto', () => {
    render(<ExportView />);
    expect(columna().querySelectorAll('ul, ol, dl, table, section, article')).toHaveLength(0);
    expect(columna().querySelectorAll('h2, h3, h4')).toHaveLength(0);
  });

  it('usa el padding del shell en la columna', () => {
    /* El ancho `clamp(340px, 32vw, 440px)` no se puede afirmar por el estilo
       calculado: el parser de jsdom descarta `clamp()` y lo deja vacio. El
       padding si, y es el que la spec fija en 60px 48px. */
    render(<ExportView />);
    expect(columna().style.padding).toBe('60px 48px');
  });
});

describe('T17 — ExportView: acciones', () => {
  beforeEach(() => cargar());

  it('“Convertir otro” vuelve al inicio limpio sin descargar nada', () => {
    render(<ExportView />);
    expect(useDocStore.getState().atHome).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Convertir otro' }));

    /* Se comprueba el store real, no un mock: `goHome` levanta `atHome` y
       deja el documento cargado (es su semantica, no un teardown). */
    expect(useDocStore.getState().atHome).toBe(true);
    expect(useDocStore.getState().doc).not.toBeNull();
    expect(useDocStore.getState().exportDocx).not.toHaveBeenCalled();
    expect(useDocStore.getState().clearQuickExport).not.toHaveBeenCalled();
  });

  it('“Descargar documento” avisa de las citas fantasma antes de exportar', () => {
    cargar({ citationAuditResult: TRES_CITAS_FANTASMA });
    render(<ExportView />);

    fireEvent.click(screen.getByRole('button', { name: 'Descargar documento' }));

    /* La friccion se mantiene: primer clic avisa, no exporta. */
    expect(useDocStore.getState().exportDocx).not.toHaveBeenCalled();
    expect(screen.getByText(/sin referencia en la bibliograf/i)).toBeTruthy();
  });

  it('el atajo Ctrl+S exporta una vez y se queda con el atajo del navegador', () => {
    render(<ExportView />);

    /* fireEvent devuelve false cuando el evento fue cancelado. */
    const noCancelado = fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(noCancelado).toBe(false);
    expect(useDocStore.getState().exportDocx).toHaveBeenCalledTimes(1);
  });

  it('el atajo no se re-registra en cada render', () => {
    const add = vi.spyOn(window, 'addEventListener');
    render(<ExportView />);
    const alMontar = add.mock.calls.filter((c) => c[0] === 'keydown').length;
    expect(alMontar).toBe(1);

    /* Un render nuevo no debe volver a suscribir el atajo: el efecto
       depende de un callback memoizado, no de "cada render". */
    act(() => {
      useDocStore.setState({ isLoading: true });
    });

    expect(add.mock.calls.filter((c) => c[0] === 'keydown')).toHaveLength(alMontar);
    add.mockRestore();
  });

  it('el formato y la vista previa siguen alcanzables bajo el toggle de opciones', () => {
    render(<ExportView />);
    const toggle = screen.getByRole('button', { name: 'Opciones' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Selector de formato')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const formatos = screen.getByLabelText('Selector de formato');
    const pdf = Array.from(formatos.querySelectorAll('button')).find((b) =>
      b.textContent!.includes('PDF Listo'),
    )!;
    fireEvent.click(pdf);
    expect(pdf.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Previsualizar/ })).toBeTruthy();

    /* Cerrado, la columna vuelve a ser la de cuatro piezas. */
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('Selector de formato')).toBeNull();
  });
});

describe('T17 — ExportView: higiene del archivo', () => {
  it('no tiene iconos muertos ni estilos huerfanos', () => {
    expect(SRC).not.toMatch(/ICON_PALETTES|summaryItemStyle|summaryTitleStyle|summaryDescStyle|iconBox/);
  });

  it('no trae hex literales fuera del design system', () => {
    expect(SRC).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
