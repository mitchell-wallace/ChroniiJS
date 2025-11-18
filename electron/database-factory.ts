import { BetterSQLiteDatabaseService } from './database-better-sqlite3';
import type { TimeEntry } from './database-better-sqlite3';

export interface IDatabaseService {
  createTimeEntry(taskName: string, startTime: number, project?: string | null): TimeEntry;
  getTimeEntry(id: number): TimeEntry | null;
  stopTimeEntry(id: number, endTime: number): TimeEntry | null;
  getActiveTimeEntry(): TimeEntry | null;
  getAllTimeEntries(limit?: number, offset?: number, project?: string | null): TimeEntry[];
  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'project' | 'startTime' | 'endTime' | 'logged'>>): TimeEntry | null;
  deleteTimeEntry(id: number): boolean;
  getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[];
  // Projects
  createProject(name: string): void;
  getAllProjects(): string[];
  getEntriesCountByProject(project: string | null): number;
  deleteEntriesByProject(project: string | null): number;
  renameProject(oldName: string, newName: string): number;
  // Lifecycle / introspection
  close(): void;
  getInfo(): { path: string; isOpen: boolean; environment: string };
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
  console.log('Initializing better-sqlite3 database...');
  const service = new BetterSQLiteDatabaseService();
  return service;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}