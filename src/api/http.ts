/* WordAPA7 — Cliente HTTP base (sin dependencias de store para evitar ciclos de import) */

export const getApiBase = (): string => {
  if (!(window as any).electronAPI) return '/api';
  const port = (window as any).electronAPI.getBackendPort();
  return `http://127.0.0.1:${port}/api`;
};

/**
 * Resuelve URLs root-relative del backend (p.ej. "/api/images/{session}/{file}").
 * En el navegador (dev) funcionan tal cual; en Electron se sirven desde el esquema
 * "app://" así que hay que apuntarlas al backend Python explícitamente.
 */
export const resolveAssetUrl = (url: string): string => {
  if (!url) return url;
  if (!(window as any).electronAPI) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  const port = (window as any).electronAPI.getBackendPort();
  return `http://127.0.0.1:${port}${url.startsWith('/') ? '' : '/'}${url}`;
};

/** Listener opcional para el tracing de X-Request-ID (lo registra el store). */
let requestIdListener: ((id: string) => void) | null = null;
export const setRequestIdListener = (fn: ((id: string) => void) | null): void => {
  requestIdListener = fn;
};

/** Wrapper que extrae X-Request-ID para debug tracing sin acoplarse al store. */
export async function fetchWithTrace(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const rid = res.headers.get('X-Request-ID');
  if (rid) requestIdListener?.(rid);
  return res;
}
