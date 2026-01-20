export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}

interface TimerAPI {
  startTimer: (taskName: string) => Promise<TimeEntry>;
  stopTimer: (id: number) => Promise<TimeEntry | null>;
  getActiveTimer: () => Promise<TimeEntry | null>;
}

interface EntriesAPI {
  getAllEntries: (limit?: number, offset?: number) => Promise<TimeEntry[]>;
  getEntryById: (id: number) => Promise<TimeEntry | null>;
  updateEntry: (id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>) => Promise<TimeEntry | null>;
  deleteEntry: (id: number) => Promise<boolean>;
  getEntriesInRange: (startDate: number, endDate: number) => Promise<TimeEntry[]>;
}

interface DatabaseAPI {
  getInfo: () => Promise<{ path: string; isOpen: boolean }>;
  exportDatabase: (destinationPath: string) => Promise<boolean>;
  importDatabase: (sourcePath: string) => Promise<boolean>;
  exportCsv: (destinationPath?: string) => Promise<boolean>;
  importCsv: (sourcePathOrCsv: string | Uint8Array, options?: { dedupe?: boolean }) => Promise<boolean>;
  previewImportCsv: (sourcePathOrCsv: string | Uint8Array, options?: { dedupe?: boolean }) => Promise<PreviewResult>;
  previewRestoreDb: (buffer: Uint8Array, mode: RestoreMode) => Promise<PreviewResult>;
  restoreDbWithOptions: (buffer: Uint8Array, mode: RestoreMode) => Promise<boolean>;
  applyChanges: (changes: { adds?: PreviewEntrySnapshot[]; removes?: PreviewEntrySnapshot[]; updates?: PreviewEntrySnapshot[] }) => Promise<boolean>;
  clearAllData: () => Promise<boolean>;
  selectExportPath: (suggestedName?: string) => Promise<string | null>;
  selectImportPath: () => Promise<string | null>;
  selectCsvExportPath: (suggestedName?: string) => Promise<string | null>;
  selectCsvImportPath: () => Promise<string | null>;
}

interface BackupEntry {
  type: 'weekly' | 'version' | 'manual';
  name: string;
  path: string;
  createdAt: number;
}

type RestoreMode = 'replace' | 'dedupe' | 'merge' | 'keep-newer';
type PreviewAction = 'add' | 'remove' | 'skip' | 'rollback';

interface PreviewEntrySnapshot {
  id?: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}

interface PreviewItem {
  action: PreviewAction;
  entry: PreviewEntrySnapshot;
  source: 'import' | 'backup' | 'current';
  incomingEntry?: PreviewEntrySnapshot;
  currentEntry?: PreviewEntrySnapshot;
}

interface PreviewResult {
  summary: {
    adds: number;
    removes: number;
    rollbacks?: number;
    skips: number;
    total: number;
  };
  items: PreviewItem[];
  cutoffTime?: number;
  mode?: RestoreMode;
}

interface ChroniiConfig {
  backup: {
    enabled: boolean;
    format: 'db' | 'csv' | 'both';
    location: string | null;
    weeklyRetention: number;
    lastWeeklyBackup: string | null;
    lastVersion: string | null;
    versionRetention: number;
    reminders?: {
      enabled: boolean;
      dayOfWeek: number;
      format: 'db' | 'csv';
      lastDismissed: string | null;
    };
  };
}

interface ConfigAPI {
  getConfig: () => Promise<ChroniiConfig>;
  setConfig: (config: ChroniiConfig) => Promise<ChroniiConfig>;
  updateConfig: (updates: Partial<ChroniiConfig>) => Promise<ChroniiConfig>;
}

interface BackupAPI {
  createBackup: () => Promise<BackupEntry | null>;
  listBackups: () => Promise<BackupEntry[]>;
  restoreBackup: (backupPath: string) => Promise<boolean>;
  restoreBackupWithOptions: (backupPath: string, mode: RestoreMode) => Promise<boolean>;
  previewRestore: (backupPath: string, mode: RestoreMode) => Promise<PreviewResult>;
  cleanupBackups: () => Promise<{ deleted: number; backupDir: string; freedBytes?: number }>;
  previewCleanup: () => Promise<{ backupDir: string; totalFiles: number; totalBytes: number; files: Array<{ name: string; path: string; size: number }> }>;
  selectBackupLocation: () => Promise<string | null>;
  selectRestoreFile: () => Promise<string | null>;
}

interface ShellAPI {
  openPath: (targetPath: string) => Promise<boolean>;
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
    databaseAPI: DatabaseAPI;
    configAPI: ConfigAPI;
    backupAPI: BackupAPI;
    shellAPI: ShellAPI;
    windowAPI: WindowAPI;
    viewAPI: ViewAPI;
  }
}
