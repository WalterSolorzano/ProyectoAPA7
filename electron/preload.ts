import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  addRecentDocument: (path: string) => ipcRenderer.send('add-recent-document', path),
  setTheme: (theme: 'light' | 'dark') => ipcRenderer.send('set-theme', theme),
  onMenuAction: (callback: (event: any, action: string) => void) => ipcRenderer.on('menu-action', callback),
  // Emitido por PythonManager cuando el backend ha terminado de arrancar
  onPythonReady: (callback: () => void) => {
    ipcRenderer.on('python-ready', callback)
    // Return a cleanup function
    return () => ipcRenderer.removeListener('python-ready', callback)
  },
  // Watchdog: el backend crasheó / se está reiniciando
  onPythonCrashed: (callback: () => void) => {
    ipcRenderer.on('python-crashed', callback)
    return () => ipcRenderer.removeListener('python-crashed', callback)
  },
  onPythonRestarting: (callback: () => void) => {
    ipcRenderer.on('python-restarting', callback)
    return () => ipcRenderer.removeListener('python-restarting', callback)
  },
  getBackendPort: () => ipcRenderer.sendSync('get-backend-port'),
  // Abre una URL externa en el navegador del sistema (fallback de descarga manual)
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  // Actualizaciones: estado + acciones del menú de update
  getAppVersion: () => ipcRenderer.sendSync('get-app-version'),
  checkForUpdates: () => ipcRenderer.send('update:check'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdateStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, status: any) => callback(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },
  // ── Context Menu integration ──────────────────────────────────────────
  // Recibe un archivo .docx desde el menú contextual de Windows
  // (click derecho → "Convertir a APA 7 con WordAPA7").
  // El main process lee el archivo del disco y envía { fileName, buffer }.
  onOpenFileFromOS: (callback: (data: { fileName: string; buffer: Uint8Array }) => void) => {
    const listener = (_event: any, data: { fileName: string; buffer: Uint8Array }) => callback(data)
    ipcRenderer.on('open-file-from-os', listener)
    return () => ipcRenderer.removeListener('open-file-from-os', listener)
  }
})
