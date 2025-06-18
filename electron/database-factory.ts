import { BetterSQLiteDatabaseService } from './database-better-sqlite3';
import { DatabaseService } from './database';
import type { TimeEntry } from './database';

export interface IDatabaseService {
  createTimeEntry(taskName: string, startTime: number): TimeEntry;
  getTimeEntry(id: number): TimeEntry | null;
  stopTimeEntry(id: number, endTime: number): TimeEntry | null;
  getActiveTimeEntry(): TimeEntry | null;
  getAllTimeEntries(limit?: number, offset?: number): TimeEntry[];
  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime'>>): TimeEntry | null;
  deleteTimeEntry(id: number): boolean;
  getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[];
  close(): void;
  getInfo(): { path: string; isOpen: boolean };
}

// Singleton instance
let dbInstance: IDatabaseService | null = null;
let dbInitPromise: Promise<IDatabaseService> | null = null;

export async function getDatabase(): Promise<IDatabaseService> {
  if (!dbInstance) {
    if (!dbInitPromise) {
      dbInitPromise = initializeDatabase();
    }
    dbInstance = await dbInitPromise;
  }
  return dbInstance;
}

async function initializeDatabase(): Promise<IDatabaseService> {
  // Check if we're in Electron environment
  const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
  
  if (isElectron) {
    try {
      // Try better-sqlite3 first
      console.log('Initializing better-sqlite3 database...');
      const service = new BetterSQLiteDatabaseService();
      return service;
    } catch (error) {
      console.warn('Failed to initialize better-sqlite3, falling back to sql.js:', error);
      // Fallback to sql.js
      const service = new DatabaseService();
      await service.waitForInitialization();
      return service;
    }
  } else {
    // Web environment - use sql.js
    console.log('Web environment detected, using sql.js database...');
    const service = new DatabaseService();
    await service.waitForInitialization();
    return service;
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}