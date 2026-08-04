import { app, BrowserWindow, ipcMain, protocol, nativeTheme } from 'electron'
import path from 'path'
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

  createWindow()

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
