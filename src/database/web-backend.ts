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
  // Wait for initialization to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  return db;
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
