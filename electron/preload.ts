import { ipcRenderer, contextBridge } from 'electron'

export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// Expose timer API
contextBridge.exposeInMainWorld('timerAPI', {
  startTimer: (taskName: string): Promise<TimeEntry> => 
    ipcRenderer.invoke('timer:start', taskName),
  
  stopTimer: (id: number): Promise<TimeEntry | null> => 
    ipcRenderer.invoke('timer:stop', id),
  
  getActiveTimer: (): Promise<TimeEntry | null> => 
    ipcRenderer.invoke('timer:get-active'),
})

// Expose entries API
contextBridge.exposeInMainWorld('entriesAPI', {
  getAllEntries: (limit?: number, offset?: number): Promise<TimeEntry[]> => 
    ipcRenderer.invoke('entries:get-all', limit, offset),
  
  getEntryById: (id: number): Promise<TimeEntry | null> => 
    ipcRenderer.invoke('entries:get-by-id', id),
  
  updateEntry: (id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime'>>): Promise<TimeEntry | null> => 
    ipcRenderer.invoke('entries:update', id, updates),
  
  deleteEntry: (id: number): Promise<boolean> => 
    ipcRenderer.invoke('entries:delete', id),
  
  getEntriesInRange: (startDate: number, endDate: number): Promise<TimeEntry[]> => 
    ipcRenderer.invoke('entries:get-range', startDate, endDate),
})

// Expose database API
contextBridge.exposeInMainWorld('databaseAPI', {
  getInfo: (): Promise<{ path: string; isOpen: boolean }> => 
    ipcRenderer.invoke('db:info'),
})

// Expose window control API
contextBridge.exposeInMainWorld('windowAPI', {
  minimize: (): Promise<void> => 
    ipcRenderer.invoke('window:minimize'),
  
  maximize: (): Promise<void> => 
    ipcRenderer.invoke('window:maximize'),
  
  close: (): Promise<void> => 
    ipcRenderer.invoke('window:close'),
  
  isMaximized: (): Promise<boolean> => 
    ipcRenderer.invoke('window:is-maximized'),
})
