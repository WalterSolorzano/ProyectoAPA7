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
  getBackendPort: () => ipcRenderer.sendSync('get-backend-port')
})
