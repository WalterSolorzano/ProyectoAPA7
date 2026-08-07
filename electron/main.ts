import { app, BrowserWindow, ipcMain, protocol, nativeTheme, dialog } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import { PythonManager } from './python-manager'
import { setupWindowControls } from './ipc/window-controls'
import { createMenu } from './menu'
import { RecentProjects } from './recent-projects'
import { log } from './logger'

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  // El tema se sincroniza desde la UI vía IPC 'set-theme' (light por defecto).
  nativeTheme.themeSource = 'light'
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 768,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',        // --sidebar-bg claro (default de la app)
      symbolColor: '#1a1a2e'   // --text-main oscuro para los símbolos nativos
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load React UI immediately for instant startup feel
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadURL('app://-/index.html')
  }

  // Start python process in background after UI is loaded
  try {
    PythonManager.start().catch(err => {
      console.error('Failed to start python backend:', err)
    })
  } catch (error) {
    console.error('Failed to start python backend:', error)
  }

  // DevTools debugging removed for production

  // Zoom hardening (plan §3.2 fix #4): bloquear zoomLevel a 0 salvo acción explícita,
  // y acotarlo entre 0.5 y 2.0 para evitar el bug de zoom atascado en 235%.
  mainWindow.webContents.setZoomLevel(0);
  mainWindow.webContents.on('zoom-changed', (_event, zoomDirection) => {
    const current = mainWindow?.webContents.getZoomLevel() || 0;
    const next = zoomDirection === 'in' ? current + 0.5 : current - 0.5;
    if (next >= -0.5 && next <= 1.0) {
      mainWindow?.webContents.setZoomLevel(next);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // level: 0 = debug, 1 = info, 2 = warning, 3 = error
    const levelStr = level === 3 ? 'error' : level === 2 ? 'warn' : level === 1 ? 'info' : 'debug';
    log(levelStr as any, 'renderer', message, { line, sourceId });
  });
  
  // Also log if there's a failed load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('error', 'renderer-fail-load', `${errorDescription} (${errorCode}) for ${validatedURL}`);
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

app.whenReady().then(() => {
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const parsedUrl = new URL(request.url)
      let pathname = parsedUrl.pathname
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1)
      }
      callback({ path: path.normalize(path.join(__dirname, '../dist', pathname)) })
    } catch (e) {
      console.error('Failed to parse URL in protocol handler', e)
    }
  })

  // Native menus removed in favor of a clean Word-like experience
  // createMenu()
  setupWindowControls()
  
  ipcMain.on('add-recent-document', (event, filePath) => {
    RecentProjects.add(filePath)
  })

  ipcMain.on('set-theme', (_event, theme: 'light' | 'dark') => {
    nativeTheme.themeSource = theme === 'dark' ? 'dark' : 'light'
    if (mainWindow) {
      mainWindow.setTitleBarOverlay({
        color: theme === 'dark' ? '#18181c' : '#ffffff',
        symbolColor: theme === 'dark' ? '#e8e8ea' : '#1a1a2e',
      })
    }
  })

  ipcMain.on('get-backend-port', (event) => {
    event.returnValue = PythonManager.port
  })

  // ── Actualizaciones (menú de update) ─────────────────────────────────────
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const sendUpdateStatus = (status: Record<string, unknown>) => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w && !w.isDestroyed()) w.webContents.send('update:status', status)
  }

  const mainWin = () => BrowserWindow.getAllWindows()[0] || undefined

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'available', info }))
  autoUpdater.on('update-not-available', (info) => sendUpdateStatus({ state: 'not-available', info }))
  autoUpdater.on('download-progress', (p) => sendUpdateStatus({ state: 'downloading', progress: Math.round(p.percent * 10) / 10 }))
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', info })
    // Preguntar antes de reiniciar e instalar (el usuario espera ser consultado)
    const w = mainWin()
    if (w && !w.isDestroyed()) {
      const v = (info as any)?.version || ''
      dialog.showMessageBox(w, {
        type: 'info',
        title: 'Actualización lista',
        message: `WordAPA7 v${v} se descargó correctamente.`,
        detail: '¿Querés reiniciar la app ahora para instalarla?',
        buttons: ['Reiniciar ahora', 'Después'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      }).catch(() => {})
    }
  })
  autoUpdater.on('error', (err) => {
    console.error('auto-updater error:', err)
    sendUpdateStatus({ state: 'error', message: err?.message || String(err) })
  })

  ipcMain.on('get-app-version', (event) => {
    event.returnValue = app.getVersion()
  })
  ipcMain.on('update:check', () => {
    autoUpdater.checkForUpdates().catch(() => {})
  })
  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  createWindow()

  // Chequeo inicial al arrancar + reintento a los ~10s (por si el primero
  // arrancó antes de que la red/el backend estén listos y falló en silencio).
  const runCheck = () => autoUpdater.checkForUpdates().catch(() => {})
  try { runCheck() } catch { /* best-effort */ }
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { runCheck() } catch { /* best-effort */ }
    }
  }, 10000)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  PythonManager.stop()
})
