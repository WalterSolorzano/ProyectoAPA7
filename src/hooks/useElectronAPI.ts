export function useElectronAPI() {
  // @ts-ignore
  const api = window.electronAPI

  if (api) {
    return api
  }

  // Fallbacks for web mode
  return {
    windowMinimize: () => console.log('windowMinimize not available in web mode'),
    windowMaximize: () => console.log('windowMaximize not available in web mode'),
    windowClose: () => console.log('windowClose not available in web mode'),
    addRecentDocument: (path: string) => console.log(`addRecentDocument(${path}) not available in web mode`),
  }
}
