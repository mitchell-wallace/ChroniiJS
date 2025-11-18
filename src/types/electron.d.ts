export interface TimeEntry {
  id: number;
  taskName: string;
  project: string | null;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}

interface TimerAPI {
  startTimer: (taskName: string, project?: string | null) => Promise<TimeEntry>;
  stopTimer: (id: number) => Promise<TimeEntry | null>;
  getActiveTimer: () => Promise<TimeEntry | null>;
}

interface EntriesAPI {
  getAllEntries: (limit?: number, offset?: number, project?: string | null) => Promise<TimeEntry[]>;
  getEntryById: (id: number) => Promise<TimeEntry | null>;
  updateEntry: (id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'project' | 'startTime' | 'endTime' | 'logged'>>) => Promise<TimeEntry | null>;
  deleteEntry: (id: number) => Promise<boolean>;
  getEntriesInRange: (startDate: number, endDate: number) => Promise<TimeEntry[]>;
}

interface ProjectsAPI {
  createProject: (name: string) => Promise<void>;
  getAllProjects: () => Promise<string[]>;
  getProjectCount: (project: string | null) => Promise<number>;
  deleteProject: (project: string | null) => Promise<number>;
  renameProject: (oldName: string, newName: string) => Promise<number>;
}

interface DatabaseAPI {
  getInfo: () => Promise<{ path: string; isOpen: boolean }>;
}

interface WindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

interface ViewAPI {
  reload: () => Promise<void>;
  forceReload: () => Promise<void>;
  openDevTools: () => Promise<void>;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
  zoomReset: () => Promise<void>;
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
    projectsAPI: ProjectsAPI;
    databaseAPI: DatabaseAPI;
    windowAPI: WindowAPI;
    viewAPI: ViewAPI;
  }
}