export const isElectronRenderer = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;

  // Standard Electron renderer detection when process is exposed
  if (w.process && typeof w.process === 'object' && w.process.type === 'renderer') {
    return true;
  }

  // With contextIsolation and no nodeIntegration, preload still exposes ipcRenderer
  if (w.ipcRenderer) {
    return true;
  }

  return false;
};
