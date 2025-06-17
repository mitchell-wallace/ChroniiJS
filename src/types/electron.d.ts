export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
}

interface TimerAPI {
  startTimer: (taskName: string) => Promise<TimeEntry>;
  stopTimer: (id: number) => Promise<TimeEntry | null>;
  getActiveTimer: () => Promise<TimeEntry | null>;
}

interface EntriesAPI {
  getAllEntries: (limit?: number, offset?: number) => Promise<TimeEntry[]>;
  getEntryById: (id: number) => Promise<TimeEntry | null>;
  updateEntry: (id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime'>>) => Promise<TimeEntry | null>;
  deleteEntry: (id: number) => Promise<boolean>;
  getEntriesInRange: (startDate: number, endDate: number) => Promise<TimeEntry[]>;
}

interface DatabaseAPI {
  getInfo: () => Promise<{ path: string; isOpen: boolean }>;
}

interface ElectronAPI {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  off: (channel: string, listener?: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    ipcRenderer: ElectronAPI;
    timerAPI: TimerAPI;
    entriesAPI: EntriesAPI;
    databaseAPI: DatabaseAPI;
  }
}