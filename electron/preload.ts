import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  addRecentDocument: (path: string) => ipcRenderer.send('add-recent-document', path),
  onMenuAction: (callback: (event: any, action: string) => void) => ipcRenderer.on('menu-action', callback),
  // Emitido por PythonManager cuando el backend ha terminado de arrancar
  onPythonReady: (callback: () => void) => {
    ipcRenderer.on('python-ready', callback)
    // Return a cleanup function
    return () => ipcRenderer.removeListener('python-ready', callback)
  },
  getBackendPort: () => ipcRenderer.sendSync('get-backend-port')
})
