/* WordAPA7 — Cliente HTTP base (sin dependencias de store para evitar ciclos de import)
 *
 * El backend Python puede correr en HTTP o HTTPS (este último cuando hay
 * certificados SSL generados para el Word Add-in, ya que Office.js los
 * requiere). Este módulo detecta automáticamente cuál protocolo usar:
 * intenta HTTPS primero y cae a HTTP si no responde.
 */

/** Protocolo detectado del backend (cacheado tras la primera detección). */
let _backendProtocol: 'https' | 'http' | null = null;

/** Detecta si el backend responde por HTTPS, cacheando el resultado. */
async function _detectProtocol(port: number): Promise<'https' | 'http'> {
  if (_backendProtocol) return _backendProtocol;

  // Intentar HTTPS primero (con timeout corto de 1.5s)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`https://127.0.0.1:${port}/api/version`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      _backendProtocol = 'https';
      return 'https';
    }
  } catch {
    // HTTPS no disponible (cert no configurado o rechazado) → intentar HTTP
  }

  _backendProtocol = 'http';
  return _backendProtocol;
}

export const getApiBase = (): string => {
  if (!(window as any).electronAPI) return '/api';
  const port = (window as any).electronAPI.getBackendPort();

  // Si ya detectamos el protocolo, usarlo directamente (sin await)
  if (_backendProtocol) {
    return `${_backendProtocol}://127.0.0.1:${port}/api`;
  }

  // Detección inicial asíncrona: por defecto HTTP, y _detectProtocol
  // actualizará el cache para las próximas llamadas.
  _detectProtocol(port).catch(() => {});
  return `http://127.0.0.1:${port}/api`;
};

/**
 * Versión asíncrona de getApiBase() que garantiza haber detectado el
 * protocolo correcto antes de devolver la URL. Usar cuando se necesita
 * la URL correcta inmediatamente (ej: al arrancar la app).
 */
export async function getApiBaseAsync(): Promise<string> {
  if (!(window as any).electronAPI) return '/api';
  const port = (window as any).electronAPI.getBackendPort();
  const proto = await _detectProtocol(port);
  return `${proto}://127.0.0.1:${port}/api`;
}

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
  const proto = _backendProtocol || 'http';
  return `${proto}://127.0.0.1:${port}${url.startsWith('/') ? '' : '/'}${url}`;
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
