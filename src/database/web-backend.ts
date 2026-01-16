import { SqlJsDatabaseService, type TimeEntry } from './database-sqljs';

// Singleton database instance
let dbInstance: SqlJsDatabaseService | null = null;
let initPromise: Promise<SqlJsDatabaseService> | null = null;

async function getDatabase(): Promise<SqlJsDatabaseService> {
  if (!dbInstance) {
    if (!initPromise) {
      initPromise = initializeDatabase();
    }
    dbInstance = await initPromise;
  }
  return dbInstance;
}

async function initializeDatabase(): Promise<SqlJsDatabaseService> {
  const db = new SqlJsDatabaseService();
  // Ensure the underlying sql.js Database is fully initialized
  await db.waitUntilReady();
  return db;
}

type ChroniiConfig = {
  backup: {
    enabled: boolean;
    location: string | null;
    weeklyRetention: number;
    lastWeeklyBackup: string | null;
    lastVersion: string | null;
    versionRetention: number;
  };
};

const DEFAULT_CONFIG: ChroniiConfig = {
  backup: {
    enabled: true,
    location: null,
    weeklyRetention: 6,
    lastWeeklyBackup: null,
    lastVersion: null,
    versionRetention: 2,
  },
};

function getStoredConfig(): ChroniiConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem('chronii-config');
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ChroniiConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      backup: {
        ...DEFAULT_CONFIG.backup,
        ...(parsed.backup ?? {}),
      },
    };
  } catch (error) {
    console.warn('Failed to read web config, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

function saveStoredConfig(config: ChroniiConfig): ChroniiConfig {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('chronii-config', JSON.stringify(config));
  }
  return config;
}

function updateStoredConfig(updates: Partial<ChroniiConfig>): ChroniiConfig {
  const current = getStoredConfig();
  const merged: ChroniiConfig = {
    ...current,
    ...updates,
    backup: {
      ...current.backup,
      ...(updates.backup ?? {}),
    },
  };
  return saveStoredConfig(merged);
}

function downloadDatabase(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Web backend API that mimics the Electron IPC API
export const webBackend = {
  timerAPI: {
    startTimer: async (taskName: string): Promise<TimeEntry> => {
      const db = await getDatabase();
      // Stop any active timer first
      const activeEntry = db.getActiveTimeEntry();
      if (activeEntry) {
        db.stopTimeEntry(activeEntry.id, Date.now());
      }
      // Start new timer
      return db.createTimeEntry(taskName, Date.now());
    },

    stopTimer: async (id: number): Promise<TimeEntry | null> => {
      const db = await getDatabase();
      return db.stopTimeEntry(id, Date.now());
    },

    getActiveTimer: async (): Promise<TimeEntry | null> => {
      const db = await getDatabase();
      return db.getActiveTimeEntry();
    },
  },

  entriesAPI: {
    getAllEntries: async (limit?: number, offset?: number): Promise<TimeEntry[]> => {
      const db = await getDatabase();
      return db.getAllTimeEntries(limit, offset);
    },

    getEntryById: async (id: number): Promise<TimeEntry | null> => {
      const db = await getDatabase();
      return db.getTimeEntry(id);
    },

    updateEntry: async (
      id: number,
      updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>
    ): Promise<TimeEntry | null> => {
      const db = await getDatabase();
      return db.updateTimeEntry(id, updates);
    },

    deleteEntry: async (id: number): Promise<boolean> => {
      const db = await getDatabase();
      return db.deleteTimeEntry(id);
    },

    getEntriesInRange: async (startDate: number, endDate: number): Promise<TimeEntry[]> => {
      const db = await getDatabase();
      return db.getTimeEntriesInRange(startDate, endDate);
    },
  },

  databaseAPI: {
    getInfo: async (): Promise<{ path: string; isOpen: boolean }> => {
      const db = await getDatabase();
      return db.getInfo();
    },
    exportDatabase: async (): Promise<boolean> => {
      const db = await getDatabase();
      const data = db.export();
      downloadDatabase(data, `chronii-database-${Date.now()}.db`);
      return true;
    },
    importDatabase: async (data: Uint8Array): Promise<boolean> => {
      const db = await getDatabase();
      (db as SqlJsDatabaseService).importFromBuffer(data);
      return true;
    },
    selectExportPath: async () => null,
    selectImportPath: async () => null,
  },

  configAPI: {
    getConfig: async (): Promise<ChroniiConfig> => {
      return getStoredConfig();
    },
    setConfig: async (config: ChroniiConfig): Promise<ChroniiConfig> => {
      return saveStoredConfig(config);
    },
    updateConfig: async (updates: Partial<ChroniiConfig>): Promise<ChroniiConfig> => {
      return updateStoredConfig(updates);
    },
  },

  backupAPI: {
    createBackup: async (): Promise<null> => {
      const db = await getDatabase();
      const data = db.export();
      downloadDatabase(data, `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-chronii-database.db.bak`);
      return null;
    },
    listBackups: async (): Promise<[]> => {
      return [];
    },
    restoreBackup: async (): Promise<boolean> => {
      console.warn('Restore not supported directly in web version');
      return false;
    },
    selectBackupLocation: async (): Promise<string | null> => null,
    selectRestoreFile: async (): Promise<string | null> => null,
  },

  // Note: Window and View APIs are not applicable for web version
  windowAPI: {
    minimize: async () => {
      console.warn('Window minimize not supported in web version');
    },
    maximize: async () => {
      console.warn('Window maximize not supported in web version');
    },
    close: async () => {
      console.warn('Window close not supported in web version');
    },
    isMaximized: async (): Promise<boolean> => {
      return false;
    },
  },

  viewAPI: {
    reload: async () => {
      window.location.reload();
    },
    forceReload: async () => {
      window.location.reload();
    },
    openDevTools: async () => {
      console.warn('Dev tools can be opened via browser: F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows/Linux)');
    },
    zoomIn: async () => {
      console.warn('Browser zoom not supported programmatically. Use Ctrl+Plus or Cmd+Plus');
    },
    zoomOut: async () => {
      console.warn('Browser zoom not supported programmatically. Use Ctrl+Minus or Cmd+Minus');
    },
    zoomReset: async () => {
      console.warn('Browser zoom reset not supported programmatically. Use Ctrl+0 or Cmd+0');
    },
  },
};

// Helper to initialize the web backend and inject it into window
export async function initializeWebBackend() {
  // Make sure database is initialized
  await getDatabase();

  // Inject APIs into window object for compatibility with existing components
  // Only if window exists (browser environment)
  if (typeof window !== 'undefined') {
    (window as any).timerAPI = webBackend.timerAPI;
    (window as any).entriesAPI = webBackend.entriesAPI;
    (window as any).databaseAPI = webBackend.databaseAPI;
    (window as any).configAPI = webBackend.configAPI;
    (window as any).backupAPI = webBackend.backupAPI;
    (window as any).windowAPI = webBackend.windowAPI;
    (window as any).viewAPI = webBackend.viewAPI;
  }

  console.log('Web backend initialized');
}

// Helper to reset database instance for tests
export function resetDatabaseForTests() {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = null;
  initPromise = null;
}
