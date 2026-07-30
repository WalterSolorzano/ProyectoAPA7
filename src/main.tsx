/* WordAPA7 — Entry Point with Auto-Versioning and SW Cleanup */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/fluent.css';        // base styles + Tailwind directives
import './styles/design-system.css'; // dark theme tokens override on top

// ── SERVICE WORKER CLEANUP ──────────────────────────────────────────────────

// Elimina cualquier Service Worker registrado por versiones anteriores
// para evitar que se sirva caché stale. WordAPA7 no usa SW activamente,
// así que esta limpieza es preventiva.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
      console.log('[WordAPA7] Service Worker removido:', reg.scope);
    }
  });
}

// ── VERSION POLLING ─────────────────────────────────────────────────────────

// Consulta periódica a /api/version para detectar nuevos builds
// y recargar automáticamente si el servidor tiene una versión más reciente.
const VERSION_CHECK_INTERVAL_MS = 60_000; // 60 segundos
const INITIAL_CHECK_DELAY_MS = 5_000;     // primera comprobación tras 5s

let currentBuildHash: string | null = null;

async function checkVersion(): Promise<void> {
  try {
    const port = (window as any).electronAPI ? (window as any).electronAPI.getBackendPort() : 8742;
    const baseUrl = (window as any).electronAPI ? `http://127.0.0.1:${port}/api` : '/api';
    const res = await fetch(`${baseUrl}/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;

    const data = await res.json();
    const serverHash: string = data.build_hash;

    if (!serverHash || serverHash === 'unknown') return;

    if (!currentBuildHash) {
      // Primera comprobación: registrar hash actual
      currentBuildHash = serverHash;
      console.log('[WordAPA7] Build hash:', serverHash);
      return;
    }

    if (serverHash !== currentBuildHash) {
      // ¡Nueva versión detectada! Notificar y recargar
      console.log('[WordAPA7] Nueva versión detectada:', serverHash, '(antes:', currentBuildHash, ')');
      showReloadToast();
    }
  } catch {
    // Silencio en error de red (offline, backend no disponible)
  }
}

function showReloadToast(): void {
  // Crear toast de notificación sin depender de React
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'background:#185ABD',
    'color:#fff',
    'padding:12px 20px',
    'border-radius:8px',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'font-size:14px',
    'font-weight:600',
    'z-index:99999',
    'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
    'animation:wordapa7-slide-up 0.3s ease-out',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'cursor:pointer',
    'user-select:none',
  ].join(';');

  toast.textContent = '🔄 Nueva versión disponible — Click para recargar';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes wordapa7-slide-up {
      from { transform: translateY(100px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  toast.addEventListener('click', () => {
    window.location.reload();
  });

  document.body.appendChild(toast);

  // Auto-recargar en 5 segundos si no se hace click
  setTimeout(() => {
    if (document.body.contains(toast)) {
      window.location.reload();
    }
  }, 5000);
}

// Iniciar el polling de versión con retraso inicial
setTimeout(() => {
  checkVersion();
  setInterval(checkVersion, VERSION_CHECK_INTERVAL_MS);
}, INITIAL_CHECK_DELAY_MS);

// ── RENDER ──────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
