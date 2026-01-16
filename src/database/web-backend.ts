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
    format: 'db' | 'csv' | 'both';
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
    format: 'db',
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

function escapeCsvValue(value: string): string {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
    return `"${value}"`;
  }
  return value;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseDateTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const match = trimmed.match(/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function entriesToCsv(entries: TimeEntry[]): string {
  const header = ['taskName', 'startTime', 'endTime', 'createdAt', 'updatedAt', 'logged'];
  const rows = entries.map((entry) => [
    escapeCsvValue(entry.taskName),
    formatDateTime(entry.startTime),
    entry.endTime === null ? '' : formatDateTime(entry.endTime),
    formatDateTime(entry.createdAt),
    formatDateTime(entry.updatedAt),
    entry.logged ? '1' : '0',
  ]);
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char === '\r') {
      if (csvText[i + 1] === '\n') {
        continue;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseCsvEntries(csvText: string): Array<{
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt?: number;
  updatedAt?: number;
  logged?: boolean;
}> {
  const rows = parseCsvRows(csvText).filter((row) => row.some((value) => value.trim() !== ''));
  if (rows.length === 0) return [];

  const header = rows[0].map((value) => value.trim());
  const indexOf = (name: string) => header.findIndex((value) => value.toLowerCase() === name.toLowerCase());

  const taskIndex = indexOf('taskName');
  const startIndex = indexOf('startTime');
  const endIndex = indexOf('endTime');
  const createdIndex = indexOf('createdAt');
  const updatedIndex = indexOf('updatedAt');
  const loggedIndex = indexOf('logged');

  if (taskIndex === -1 || startIndex === -1) {
    throw new Error('CSV is missing required columns.');
  }

  return rows.slice(1).map((row) => {
    const taskName = row[taskIndex] ?? '';
    const startTime = parseDateTime(row[startIndex] ?? '');
    const endValue = row[endIndex] ?? '';
    const endTime = endValue === '' ? null : parseDateTime(endValue);
    const createdValue = createdIndex >= 0 ? row[createdIndex] : '';
    const updatedValue = updatedIndex >= 0 ? row[updatedIndex] : '';
    const loggedValue = loggedIndex >= 0 ? row[loggedIndex] : '';
    const logged = loggedValue === '1' || loggedValue.toLowerCase() === 'true' || loggedValue.toLowerCase() === 'yes';

    if (startTime === null || !Number.isFinite(startTime)) {
      throw new Error('CSV contains invalid start times.');
    }

    const parsedCreated = createdValue ? parseDateTime(createdValue) : null;
    const createdAt = parsedCreated !== null ? parsedCreated : startTime;
    const parsedUpdated = updatedValue ? parseDateTime(updatedValue) : null;
    const updatedAt = parsedUpdated !== null ? parsedUpdated : createdAt;

    return {
      taskName,
      startTime,
      endTime: endTime !== null && Number.isFinite(endTime) ? endTime : null,
      createdAt,
      updatedAt,
      logged,
    };
  });
}

function downloadCsv(csvText: string, filename: string) {
  const blob = new Blob([csvText], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeTime(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value / 1000);
}

function getEntryKey(entry: {
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}): string {
  return JSON.stringify([
    entry.taskName,
    normalizeTime(entry.startTime),
    normalizeTime(entry.endTime),
    normalizeTime(entry.createdAt),
    normalizeTime(entry.updatedAt),
    entry.logged ? 1 : 0,
  ]);
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
    exportCsv: async (): Promise<boolean> => {
      const db = await getDatabase();
      const entries = db.getAllTimeEntriesForExport();
      const csvText = entriesToCsv(entries);
      downloadCsv(csvText, `chronii-entries-${Date.now()}.csv`);
      return true;
    },
    importDatabase: async (data: Uint8Array): Promise<boolean> => {
      const db = await getDatabase();
      (db as SqlJsDatabaseService).importFromBuffer(data);
      return true;
    },
    importCsv: async (csvText: string | Uint8Array, options?: { dedupe?: boolean }): Promise<boolean> => {
      const db = await getDatabase();
      const csvString = typeof csvText === 'string' ? csvText : new TextDecoder().decode(csvText);
      const entries = parseCsvEntries(csvString);
      const dedupe = options?.dedupe ?? true;
      if (dedupe) {
        const currentEntries = db.getAllTimeEntriesForExport();
        const currentKeys = new Set(currentEntries.map((entry) => getEntryKey(entry)));
        const filtered = entries.filter((entry) => !currentKeys.has(getEntryKey({
          taskName: entry.taskName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          createdAt: entry.createdAt ?? entry.startTime,
          updatedAt: entry.updatedAt ?? entry.startTime,
          logged: entry.logged ?? false,
        })));
        db.importTimeEntries(filtered);
      } else {
        db.importTimeEntries(entries);
      }
      return true;
    },
    previewImportCsv: async (csvText: string | Uint8Array, options?: { dedupe?: boolean }): Promise<any> => {
      const db = await getDatabase();
      const csvString = typeof csvText === 'string' ? csvText : new TextDecoder().decode(csvText);
      const incoming = parseCsvEntries(csvString);
      const current = db.getAllTimeEntriesForExport();
      const dedupe = options?.dedupe ?? true;
      const currentMap = new Map(
        current.map((entry) => [
          getEntryKey(entry),
          entry,
        ])
      );
      const items = incoming.map((entry) => {
        const key = getEntryKey({
          taskName: entry.taskName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          createdAt: entry.createdAt ?? entry.startTime,
          updatedAt: entry.updatedAt ?? entry.startTime,
          logged: entry.logged ?? false,
        });
        const existing = currentMap.get(key);
        if (dedupe && existing) {
          return {
            action: 'skip',
            entry,
            source: 'import',
            incomingEntry: entry,
            currentEntry: existing,
          };
        }
        return {
          action: 'add',
          entry,
          source: 'import',
          incomingEntry: entry,
        };
      });

      const adds = items.filter((item) => item.action === 'add').length;
      const skips = items.filter((item) => item.action === 'skip').length;

      return {
        summary: {
          adds,
          removes: 0,
          skips,
          total: items.length,
        },
        items,
      };
    },
    clearAllData: async (): Promise<boolean> => {
      const db = await getDatabase();
      db.clearAllEntries();
      return true;
    },
    applyChanges: async (changes: { adds?: any[]; removes?: any[] }): Promise<boolean> => {
      const db = await getDatabase();
      const removes = changes?.removes ?? [];
      const adds = changes?.adds ?? [];
      if (removes.length > 0) {
        db.deleteEntriesByMatch(removes);
      }
      if (adds.length > 0) {
        db.importTimeEntries(adds);
      }
      return true;
    },
    selectExportPath: async () => null,
    selectImportPath: async () => null,
    selectCsvExportPath: async () => null,
    selectCsvImportPath: async () => null,
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
    restoreBackupWithOptions: async (): Promise<boolean> => {
      console.warn('Restore not supported directly in web version');
      return false;
    },
    previewRestore: async (): Promise<null> => {
      console.warn('Restore preview not supported directly in web version');
      return null;
    },
    cleanupBackups: async (): Promise<{ deleted: number; backupDir: string }> => {
      console.warn('Backup cleanup not supported directly in web version');
      return { deleted: 0, backupDir: '' };
    },
    previewCleanup: async (): Promise<{ backupDir: string; totalFiles: number; totalBytes: number; files: Array<{ name: string; path: string; size: number }> }> => {
      console.warn('Backup cleanup preview not supported directly in web version');
      return { backupDir: '', totalFiles: 0, totalBytes: 0, files: [] };
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
