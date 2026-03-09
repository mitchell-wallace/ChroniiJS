import type {
	PreviewEntrySnapshot,
	TimeEntry,
	TimeEntryUpdate,
} from '../src/shared/api-types';
import { BetterSQLiteDatabaseService } from './database-better-sqlite3';

export interface IDatabaseService {
	createTimeEntry(taskName: string, startTime: number): TimeEntry;
	getTimeEntry(id: string): TimeEntry | null;
	stopTimeEntry(id: string, endTime: number): TimeEntry | null;
	getActiveTimeEntry(): TimeEntry | null;
	getAllTimeEntries(limit?: number, offset?: number): TimeEntry[];
	getAllTimeEntriesForExport(): TimeEntry[];
	clearAllEntries(): void;
	deleteEntriesByMatch(entries: PreviewEntrySnapshot[]): void;
	updateEntriesById(entries: TimeEntry[]): void;
	updateTimeEntry(id: string, updates: TimeEntryUpdate): TimeEntry | null;
	deleteTimeEntry(id: string): boolean;
	getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[];
	importTimeEntries(entries: PreviewEntrySnapshot[]): void;
	backupTo(destinationPath: string): Promise<void>;
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
