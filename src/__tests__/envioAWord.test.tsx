/**
 * El write-back a Word no puede decidir por la persona si tiene trabajo sin
 * guardar, y el frontend tiene que ofrecer las DOS salidas, no avisar.
 *
 * CONTEXTO. `POST /api/send-to-word/{session_id}` pisa el `.docx` original del
 * estudiante. Con el documento abierto en Word y cambios sin guardar,
 * `Close(SaveChanges=0)` los borra. El backend ya no lo hace: devuelve 409 con
 * `requiere_confirmacion` y no toca nada.
 *
 * LO QUE SE AFIRMA ACA. Que la respuesta de 409 produce DOS BOTONES y no un
 * aviso, que cada uno manda su bandera explícita en el body (`guardar` o
 * `forzar`), y que ninguno de los dos se dispara solo.
 *
 * Un toast con el texto "tenés cambios sin guardar" es exactamente el mismo
 * defecto que el aviso de citas fantasma que no se reseteaba: informa y no
 * deja decidir. Por eso la prueba mira `document.body` y no un toast concreto:
 * si la confirmación se arma como aviso, esto se cae igual.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useDocStore } from '../store/useDocStore';
import { ExportView } from '../components/export/ExportView';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  fetchWithTrace: vi.fn(),
  resolveAssetUrl: vi.fn(),
  syncAllProviderKeys: vi.fn().mockResolvedValue({ ok: true, applied: [] }),
}));
vi.mock('../components/layout/PaperCanvas', () => ({ PaperCanvas: () => <div data-testid="canvas" /> }));
vi.mock('../components/layout/ReactPDFPreview', () => ({ ReactPDFPreview: () => <div data-testid="pdf" /> }));
vi.mock('../components/export/QuickReferenceSearch', () => ({
  QuickReferenceSearch: () => <div data-testid="crossref" />,
}));

/** Lo que devuelve el backend cuando hay cambios sin guardar. */
const SIN_GUARDAR = {
  ok: false,
  requiere_confirmacion: true,
  message: 'Tenés cambios sin guardar en Word. Guardalos antes de enviar, o confirmá para descartarlos.',
};

/** Los cuerpos que se mandaron, en orden. */
let enviados: Array<Record<string, unknown>> = [];
let responder: (url: string) => { status: number; body: unknown };

const mockFetch = vi.fn(async (url: string, init: RequestInit) => {
  const r = responder(url);
  if (init?.body) enviados.push(JSON.parse(String(init.body)));
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    json: async () => r.body,
  } as unknown as Response;
});

const MOSTRAR_TOAST = vi.fn();

const cargar = () => {
  useDocStore.setState({
    doc: {
      session_id: 's-envio',
      file_name: 'Tesis.docx',
      elements: [],
      referencias: [],
    } as never,
    isLoading: false,
    atHome: false,
    activeFilePath: 'C:/tesis/Tesis.docx',
    citationAuditResult: null,
    exportDocx: vi.fn(),
    exportPdf: vi.fn(),
    exportLatex: vi.fn(),
    clearQuickExport: vi.fn(),
    copyPdfToClipboard: vi.fn(),
    sayMascot: vi.fn(),
    showToast: MOSTRAR_TOAST,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  enviados = [];
  responder = () => ({ status: 200, body: { ok: true, method: 'com', backup: null, message: 'Listo' } });
  vi.stubGlobal('fetch', mockFetch);
  cargar();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** El boton de enviar a Word, que solo existe con formato docx y archivo. */
const botonEnviar = () => screen.getByRole('button', { name: /Enviar a Word/i });

describe('enviar a Word sin perder lo que esta sin guardar', () => {
  it('un aviso de cambios sin guardar NO alcanza: tiene que haber dos botones', async () => {
    responder = () => ({ status: 409, body: SIN_GUARDAR });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });

    await waitFor(() => {
      expect(screen.getByTestId('confirmacion-sin-guardar')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Guardar y enviar/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Descartar y enviar/i })).toBeTruthy();

    /* Y no hay un toast: un toast informa, no deja decidir. */
    expect(MOSTRAR_TOAST).not.toHaveBeenCalled();
  });

  it('"Guardar y enviar" manda guardar:true, y no forzar', async () => {
    responder = (url) => (url.includes('send-to-word') && enviados.length === 0
      ? { status: 409, body: SIN_GUARDAR }
      : { status: 200, body: { ok: true, method: 'com', backup: null, message: 'Listo' } });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });
    await waitFor(() => screen.getByTestId('confirmacion-sin-guardar'));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar y enviar/i })); });

    await waitFor(() => expect(enviados.length).toBe(2));
    expect(enviados[1]).toMatchObject({ dest_path: 'C:/tesis/Tesis.docx', guardar: true });
    expect(enviados[1].forzar).toBeUndefined();
  });

  it('"Descartar y enviar" manda forzar:true, y no guardar', async () => {
    responder = (url) => (url.includes('send-to-word') && enviados.length === 0
      ? { status: 409, body: SIN_GUARDAR }
      : { status: 200, body: { ok: true, method: 'com', backup: null, message: 'Listo' } });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });
    await waitFor(() => screen.getByTestId('confirmacion-sin-guardar'));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Descartar y enviar/i })); });

    await waitFor(() => expect(enviados.length).toBe(2));
    /* `guardar` se afirma con `=== undefined` y no con `toBeFalsy()`: con
     * `toBeFalsy` un boton que mande la OTRA bandera sigue pasando, y asi los
     * dos botones podrian estar cambiados de nombre sin que nada se cayera. */
    expect(enviados[1]).toMatchObject({ dest_path: 'C:/tesis/Tesis.docx', forzar: true });
    expect(enviados[1].guardar).toBeUndefined();
  });

  it('la confirmacion se puede cerrar sin mandar nada', async () => {
    responder = () => ({ status: 409, body: SIN_GUARDAR });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });
    await waitFor(() => screen.getByTestId('confirmacion-sin-guardar'));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Mejor no/i })); });

    expect(screen.queryByTestId('confirmacion-sin-guardar')).toBeNull();
    expect(enviados).toHaveLength(1);
  });

  it('sin cambios sin guardar no aparece ninguna confirmacion', async () => {
    responder = () => ({ status: 200, body: { ok: true, method: 'com', backup: 'Tesis.docx.bak', message: 'Listo' } });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });

    expect(screen.queryByTestId('confirmacion-sin-guardar')).toBeNull();
    expect(MOSTRAR_TOAST).toHaveBeenCalled();
  });

  it('el respaldo se dice por su nombre, no solo "listo"', async () => {
    /* Si no se le dice a la persona dónde quedó la copia, no puede ir a
       buscarla, y un respaldo que no se encuentra no es un respaldo. */
    responder = () => ({ status: 200, body: { ok: true, method: 'com', backup: 'C:/tesis/Tesis.docx.bak', message: 'Listo' } });
    render(<ExportView />);

    await act(async () => { fireEvent.click(botonEnviar()); });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Tesis.docx.bak');
    });
  });
});
