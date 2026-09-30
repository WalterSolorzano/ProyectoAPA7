/**
 * WordAPA7 — la exportación por alcances no manda alcances inválidos.
 *
 * `scoped_apply.apply_scopes` rechaza cualquier alcance fuera de
 * `VALID_SCOPES` con un `ValueError`. Un estado guardado con los módulos finos
 * viejos (`titulos`, `tablas`, `imagenes`) entraba tal cual y hacía que la
 * exportación por partes cayera al formato completo con un aviso: el usuario
 * elegía "solo bibliografía" y recibía todo formateado.
 *
 * Ahora el borde traduce con la fuente única (`alcancesDe`) antes de llamar al
 * motor, así que al backend solo llegan alcances que entiende.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../api/backend', () => ({
  getApiBase: vi.fn().mockReturnValue('http://localhost:8742'),
  getApiBaseAsync: vi.fn().mockResolvedValue('http://localhost:8742'),
  resolveAssetUrl: vi.fn(),
  fetchWithTrace: vi.fn(),
  scopedApply: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

import { useDocStore } from '../store/useDocStore';
import * as api from '../api/backend';

const VALIDOS = ['texto', 'tablas_imagenes', 'bibliografia'];

beforeEach(() => {
  vi.clearAllMocks();
  /* `triggerDownload` hace un fetch; sin esto el test dispara una descarga real. */
  (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() });
  useDocStore.setState({
    doc: { session_id: 's1', file_name: 'trabajo.docx', elements: [] } as never,
    isLoading: false,
  } as never);
});

describe('exportDocx normaliza los alcances antes de llamar al motor', () => {
  it('un estado viejo con módulos finos no llega como alcance inválido', async () => {
    useDocStore.setState({ sessionScopes: ['titulos', 'tablas', 'imagenes'] } as never);

    await useDocStore.getState().exportDocx(false);

    expect(api.scopedApply).toHaveBeenCalledTimes(1);
    const scopes = (api.scopedApply as any).mock.calls[0][1] as string[];
    for (const s of scopes) expect(VALIDOS).toContain(s);
    expect(scopes).toContain('texto');
    expect(scopes).toContain('tablas_imagenes');
  });
});
