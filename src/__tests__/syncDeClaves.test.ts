/**
 * Lo que REALMENTE sale a la red cuando se sincronizan las claves.
 *
 * `proveedoresIA.test.ts` lee el texto del módulo y cuenta palabras. Eso tiene
 * un techo: si alguien saca `modelos` del cuerpo pero deja la palabra `modelos`
 * declarada dos líneas más arriba, el guardián ve la palabra, pasa, y el modelo
 * deja de viajar. Ya pasó: el guardián textual de esa clase se usó para
 * justificar un arreglo a medias.
 *
 * Acá se intercepta `fetch` y se mira el cuerpo. No tiene techo: si el modelo
 * no viaja, no viaja, diga lo que diga el texto del módulo.
 *
 * El módulo se importa DE VERDAD, sin mock: un test que mockea la función que
 * está probando no la está probando.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncAllProviderKeys } from '../api/backend';
import { claveDeLocalStorage, PROVEEDORES_IA } from '../lib/proveedoresIA';

interface SyncSpy {
  fetch: ReturnType<typeof vi.fn>;
  cuerpo: () => any;
  llamado: () => boolean;
}

/** Intercepta `fetch` y captura el cuerpo del sync. */
function espiarFetch(): SyncSpy {
  const llamadas: any[] = [];
  const f = vi.fn((_url: string, init: any) => {
    llamadas.push(JSON.parse(init.body));
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ applied: [], count: 0 }),
    } as Response);
  });
  vi.stubGlobal('fetch', f);
  return {
    fetch: f,
    cuerpo: () => llamadas[0] ?? null,
    llamado: () => llamadas.length > 0,
  };
}

describe('la sincronización manda lo que está escrito, y nada más', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('un modelo escrito SALE en el cuerpo, en su campo', async () => {
    localStorage.setItem(claveDeLocalStorage('GROQ_MODEL'), 'llama-3.3-70b');
    const espia = espiarFetch();

    await syncAllProviderKeys();

    expect(espia.llamado()).toBe(true);
    expect(espia.cuerpo().modelos).toMatchObject({ GROQ_MODEL: 'llama-3.3-70b' });
  });

  it('una clave SALE en su campo, y no mezclada con los modelos', async () => {
    localStorage.setItem(claveDeLocalStorage('HUGGINGFACE_API_KEY'), 'hf_123');
    const espia = espiarFetch();

    await syncAllProviderKeys();

    expect(espia.cuerpo().keys).toMatchObject({ HUGGINGFACE_API_KEY: 'hf_123' });
    expect(espia.cuerpo().modelos).toEqual({});
  });

  it('los dos campos viajan juntos cuando los dos están escritos', async () => {
    localStorage.setItem(claveDeLocalStorage('AION_API_KEY'), 'aion_1');
    localStorage.setItem(claveDeLocalStorage('AION_MODEL'), 'aion-labs/aion-3.0-mini');
    const espia = espiarFetch();

    await syncAllProviderKeys();

    expect(espia.cuerpo().keys).toMatchObject({ AION_API_KEY: 'aion_1' });
    expect(espia.cuerpo().modelos).toMatchObject({ AION_MODEL: 'aion-labs/aion-3.0-mini' });
  });

  it('cada variable del catálogo sale por el campo que le toca', async () => {
    /* Se recorre el catálogo entero. Una sola, para que el próximo proveedor que
       se agregue sin cablear se vea. */
    const sinClave: string[] = [];
    const sinModelo: string[] = [];
    for (const p of PROVEEDORES_IA) {
      for (const v of p.variablesClave) localStorage.setItem(claveDeLocalStorage(v), 'k');
      if (p.variableModelo) localStorage.setItem(claveDeLocalStorage(p.variableModelo), 'm');
    }
    const espia = espiarFetch();

    await syncAllProviderKeys();

    const cuerpo = espia.cuerpo();
    for (const p of PROVEEDORES_IA) {
      for (const v of p.variablesClave) if (!(v in cuerpo.keys)) sinClave.push(v);
      if (p.variableModelo && !(p.variableModelo in cuerpo.modelos)) sinModelo.push(p.variableModelo);
    }
    expect({ sinClave, sinModelo }).toEqual({ sinClave: [], sinModelo: [] });
  });

  it('sin nada escrito no se llama a la red', async () => {
    const espia = espiarFetch();

    await syncAllProviderKeys();

    expect(espia.llamado()).toBe(false);
  });

  it('un valor vacío no se manda: mandar "" es mandar un modelo vacío', async () => {
    localStorage.setItem(claveDeLocalStorage('GROQ_API_KEY'), '   ');
    const espia = espiarFetch();

    await syncAllProviderKeys();

    expect(espia.llamado()).toBe(false);
  });
});
