import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDocStore } from '../store/useDocStore';

/* `resolveDoiReference` es la UNICA pieza que pega un DOI a la interfaz, y el
   backend ya normaliza y ya sabe lo que devolvio. Este test fija que se use lo
   que el servidor dice, no lo que el usuario escribio y no lo que el codigo
   inventa.

   Los tres bugs que fija, los tres en la misma funcion:
   1. Guardaba el input CRUDO en `doi_or_url`. Con "doi:10.1038/x" la referencia
      salia con `https://doi.org/doi:10.1038/x`, que es un link roto.
   2. Inventaba `['Autor']` y `'Título'` cuando el servidor no trae esos datos.
      En una herramienta de citas, inventar la autoria de una obra es peor que
      no mostrarla.
   3. Inventaba `'2026'` como ano. El servidor ya devuelve "s.f." cuando no hay
      ano, que es lo que APA 7 manda. */

const respuesta = (over: Record<string, unknown> = {}) => ({
  doi: '10.1038/s41586-020-2649-2',
  authors: ['Harris, C. R.'],
  year: '2020',
  title: 'Array programming with NumPy',
  source: 'Nature',
  doi_or_url: '10.1038/s41586-020-2649-2',
  apa_formatted: 'Harris, C. R. (2020). Array programming with NumPy. Nature.',
  guardada: false,
  ...over,
});

function mockeaFetch(cuerpo: unknown, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => cuerpo,
  });
  (globalThis as any).fetch = spy;
  return spy;
}

describe('resolveDoiReference usa lo que dice el servidor', () => {
  beforeEach(() => {
    useDocStore.setState({ references: [] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guarda el DOI NORMALIZADO, no el input crudo', async () => {
    mockeaFetch(respuesta());
    await useDocStore.getState().resolveDoiReference('doi:10.1038/s41586-020-2649-2');
    const ref = useDocStore.getState().references[0];
    // Si guardara el input crudo, esto seria "doi:10.1038/..." y la referencia
    // terminaria en `https://doi.org/doi:10.1038/...`, que no abre.
    expect(ref.doi_or_url).toBe('10.1038/s41586-020-2649-2');
  });

  it('NO inventa autoria ni titulo cuando el servidor no los trae', async () => {
    mockeaFetch(respuesta({ authors: [], title: '', source: '' }));
    await useDocStore.getState().resolveDoiReference('10.1/x');
    const ref = useDocStore.getState().references[0];
    // Inventar "Autor" / "Titulo" en una referencia es una mentira
    // bibliografica. Lo que no se sabe, no se escribe.
    expect(ref.authors).toEqual([]);
    expect(ref.title).toBe('');
    expect(ref.title).not.toBe('Título');
    expect(ref.authors).not.toEqual(['Autor']);
  });

  it('NO inventa el ano: respeta el s.f. que devuelve el servidor', async () => {
    mockeaFetch(respuesta({ year: 's.f.' }));
    await useDocStore.getState().resolveDoiReference('10.1/x');
    expect(useDocStore.getState().references[0].year).toBe('s.f.');
  });

  it('deja la referencia tal cual la devuelve el servidor', async () => {
    mockeaFetch(respuesta());
    await useDocStore.getState().resolveDoiReference('10.1038/s41586-020-2649-2');
    const ref = useDocStore.getState().references[0];
    expect(ref.title).toBe('Array programming with NumPy');
    expect(ref.source).toBe('Nature');
    expect(ref.formatted_apa).toContain('Nature');
  });

  it('un error del servidor avisa y no agrega nada', async () => {
    mockeaFetch({ detail: { codigo: 'no_es_doi' } }, false, 400);
    await useDocStore.getState().resolveDoiReference('https://scholar.google.com/x');
    expect(useDocStore.getState().references).toEqual([]);
  });
});
