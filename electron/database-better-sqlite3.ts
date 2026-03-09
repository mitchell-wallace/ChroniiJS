import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';

import type {
	PreviewEntrySnapshot,
	TimeEntry,
	TimeEntryUpdate,
} from '../src/shared/api-types';
import { createCuid, normalizeImportedEntryId } from '../src/shared/cuid';

export type { TimeEntry };

type TimeEntryRow = Omit<TimeEntry, 'logged'> & { logged: number };
type TimeEntryImport = Omit<PreviewEntrySnapshot, 'logged'> & {
	logged?: boolean;
};
type SqlValue = number | string | null;

export class BetterSQLiteDatabaseService {
	private db!: Database.Database;
	private dbPath: string;
	private environment: 'development' | 'production';

	constructor() {
		// Detect environment based on Vite dev server
		this.environment = process.env.VITE_DEV_SERVER_URL
			? 'development'
			: 'production';

		// Create user data directory if it doesn't exist
		const userDataPath = app.getPath('userData');
		if (!fs.existsSync(userDataPath)) {
			fs.mkdirSync(userDataPath, { recursive: true });
		}

		// Use different database files for development and production
		const dbFileName =
			this.environment === 'development' ? 'chronii-dev.db' : 'chronii.db';
		this.dbPath = path.join(userDataPath, dbFileName);

		console.log(`Environment: ${this.environment}`);
		console.log(`Database file: ${dbFileName}`);

		this.initializeDatabase();
	}

	// Helper to convert SQLite integer to boolean for logged field
	private convertToTimeEntry(row: TimeEntryRow): TimeEntry {
		return {
			...row,
			logged: Boolean(row.logged),
		};
	}

	private initializeDatabase(): void {
		try {
			// Initialize better-sqlite3 database
			this.db = new Database(this.dbPath);

			// Enable WAL mode for better concurrent access
			this.db.pragma('journal_mode = WAL');

			this.ensureSchema();

			console.log(
				`Better-sqlite3 database initialized (${this.environment}) at:`,
				this.dbPath,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error('Failed to initialize better-sqlite3 database:', error);
			console.error('Database path:', this.dbPath);
			console.error('User data path:', app.getPath('userData'));

			// Enhanced error for better debugging
			throw new Error(
				`Database initialization failed: ${errorMessage}\nPath: ${this.dbPath}\nThis usually means better-sqlite3 native module isn't properly built for your platform.`,
			);
		}
	}

	private ensureSchema(): void {
		const columns = this.db
			.prepare('PRAGMA table_info(time_entries)')
			.all() as Array<{ name: string; type: string }>;

		if (columns.length === 0) {
			this.createTables();
			return;
		}

		const hasLogged = columns.some((column) => column.name === 'logged');
		const idColumn = columns.find((column) => column.name === 'id');
		const hasTextId = Boolean(idColumn?.type?.toUpperCase().includes('TEXT'));

		if (hasLogged && hasTextId) {
			this.createTables();
			return;
		}

		const legacyRows = this.db
			.prepare(
				hasLogged
					? `SELECT id, task_name as taskName, start_time as startTime,
               end_time as endTime, created_at as createdAt, updated_at as updatedAt, logged
           FROM time_entries
           ORDER BY created_at ASC, start_time ASC`
					: `SELECT id, task_name as taskName, start_time as startTime,
               end_time as endTime, created_at as createdAt, updated_at as updatedAt, 0 as logged
           FROM time_entries
           ORDER BY created_at ASC, start_time ASC`,
			)
			.all() as Array<{
			id: string | number;
			taskName: string;
			startTime: number;
			endTime: number | null;
			createdAt: number;
			updatedAt: number;
			logged: number;
		}>;

		const transaction = this.db.transaction(() => {
			this.db.exec('ALTER TABLE time_entries RENAME TO time_entries_legacy');
			this.createTables();

			const insert = this.db.prepare<
				[string, string, number, number | null, number, number, number]
			>(`
        INSERT INTO time_entries (id, task_name, start_time, end_time, created_at, updated_at, logged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

			for (const row of legacyRows) {
				insert.run(
					createCuid(),
					row.taskName,
					row.startTime,
					row.endTime,
					row.createdAt,
					row.updatedAt,
					row.logged ? 1 : 0,
				);
			}

			this.db.exec('DROP TABLE time_entries_legacy');
		});

		transaction();
	}

	private createTables(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY NOT NULL,
        task_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        logged INTEGER DEFAULT 0
      );
    `);

		this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`,
		);
		this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`,
		);
	}

	// Create a new time entry
	createTimeEntry(taskName: string, startTime: number): TimeEntry {
		try {
			const now = Date.now();
			const id = createCuid();
			// Default empty task names to "(untitled)"
			const finalTaskName = taskName.trim() === '' ? '(untitled)' : taskName;

			const stmt = this.db.prepare<[string, string, number, number, number]>(`
        INSERT INTO time_entries (id, task_name, start_time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

			stmt.run(id, finalTaskName, startTime, now, now);

			// Get the inserted entry
			const selectStmt = this.db.prepare<[string], TimeEntryRow>(`
        SELECT id, task_name as taskName, start_time as startTime,
               end_time as endTime, created_at as createdAt, updated_at as updatedAt,
               logged
        FROM time_entries
        WHERE id = ?
      `);

			const entry = selectStmt.get(id);
			if (!entry) {
				throw new Error('Inserted time entry could not be reloaded');
			}
			return this.convertToTimeEntry(entry);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error('Failed to create time entry:', error);
			throw new Error(
				`Failed to create time entry "${taskName}": ${errorMessage}`,
			);
		}
	}

	// Get a time entry by ID
	getTimeEntry(id: string): TimeEntry | null {
		const stmt = this.db.prepare<[string], TimeEntryRow>(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries WHERE id = ?
    `);

		const entry = stmt.get(id);
		return entry ? this.convertToTimeEntry(entry) : null;
	}

	// Update time entry end time (stop timer)
	stopTimeEntry(id: string, endTime: number): TimeEntry | null {
		const stmt = this.db.prepare<[number, number, string]>(`
      UPDATE time_entries 
      SET end_time = ?, updated_at = ?
      WHERE id = ? AND end_time IS NULL
    `);

		stmt.run(endTime, Date.now(), id);
		return this.getTimeEntry(id);
	}

	// Get active (running) time entry
	getActiveTimeEntry(): TimeEntry | null {
		const stmt = this.db.prepare<[], TimeEntryRow>(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      WHERE end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `);

		const entry = stmt.get();
		return entry ? this.convertToTimeEntry(entry) : null;
	}

	// Get all time entries (for history)
	getAllTimeEntries(limit: number = 100, offset: number = 0): TimeEntry[] {
		const stmt = this.db.prepare<[number, number], TimeEntryRow>(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `);

		const entries = stmt.all(limit, offset);
		return entries.map((entry) => this.convertToTimeEntry(entry));
	}

	// Get all time entries (for exports)
	getAllTimeEntriesForExport(): TimeEntry[] {
		const stmt = this.db.prepare<[], TimeEntryRow>(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      ORDER BY start_time DESC
    `);

		const entries = stmt.all();
		return entries.map((entry) => this.convertToTimeEntry(entry));
	}

	// Update time entry details
	updateTimeEntry(id: string, updates: TimeEntryUpdate): TimeEntry | null {
		const fields: string[] = [];
		const values: SqlValue[] = [];

		if (updates.taskName !== undefined) {
			fields.push('task_name = ?');
			// Default empty task names to "(untitled)"
			const finalTaskName =
				updates.taskName.trim() === '' ? '(untitled)' : updates.taskName;
			values.push(finalTaskName);
		}

		if (updates.startTime !== undefined) {
			fields.push('start_time = ?');
			values.push(updates.startTime);
		}

		if (updates.endTime !== undefined) {
			fields.push('end_time = ?');
			values.push(updates.endTime);
		}

		if (updates.logged !== undefined) {
			fields.push('logged = ?');
			values.push(updates.logged ? 1 : 0);
		}

		if (fields.length === 0) {
			return this.getTimeEntry(id);
		}

		fields.push('updated_at = ?');
		values.push(Date.now());
		values.push(id);

		const stmt = this.db.prepare(`
      UPDATE time_entries 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

		stmt.run(...values);
		return this.getTimeEntry(id);
	}

	// Clear all time entries
	clearAllEntries(): void {
		this.db.exec('DELETE FROM time_entries;');
	}

	deleteEntriesByMatch(entries: PreviewEntrySnapshot[]): void {
		const stmtWithEnd = this.db.prepare<
			[string, number, number, number, number, number]
		>(`
      DELETE FROM time_entries
      WHERE task_name = ? AND start_time = ? AND end_time = ? AND created_at = ? AND updated_at = ? AND logged = ?
    `);
		const stmtNoEnd = this.db.prepare<
			[string, number, number, number, number]
		>(`
      DELETE FROM time_entries
      WHERE task_name = ? AND start_time = ? AND end_time IS NULL AND created_at = ? AND updated_at = ? AND logged = ?
    `);
		const stmtById = this.db.prepare<[string]>(
			'DELETE FROM time_entries WHERE id = ?',
		);

		const transaction = this.db.transaction((rows: typeof entries) => {
			for (const entry of rows) {
				const logged = entry.logged ? 1 : 0;
				if (entry.id !== undefined) {
					stmtById.run(entry.id);
				} else if (entry.endTime === null) {
					stmtNoEnd.run(
						entry.taskName,
						entry.startTime,
						entry.createdAt,
						entry.updatedAt,
						logged,
					);
				} else {
					stmtWithEnd.run(
						entry.taskName,
						entry.startTime,
						entry.endTime,
						entry.createdAt,
						entry.updatedAt,
						logged,
					);
				}
			}
		});

		transaction(entries);
	}

	updateEntriesById(entries: TimeEntry[]): void {
		const stmt = this.db.prepare<
			[string, number, number | null, number, number, number, string]
		>(`
      UPDATE time_entries
      SET task_name = ?, start_time = ?, end_time = ?, created_at = ?, updated_at = ?, logged = ?
      WHERE id = ?
    `);

		const transaction = this.db.transaction((rows: typeof entries) => {
			for (const entry of rows) {
				stmt.run(
					entry.taskName,
					entry.startTime,
					entry.endTime,
					entry.createdAt,
					entry.updatedAt,
					entry.logged ? 1 : 0,
					entry.id,
				);
			}
		});

		transaction(entries);
	}

	// Delete time entry
	deleteTimeEntry(id: string): boolean {
		const stmt = this.db.prepare('DELETE FROM time_entries WHERE id = ?');
		const result = stmt.run(id);
		return result.changes > 0;
	}

	// Get time entries for a specific date range
	getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[] {
		const stmt = this.db.prepare<[number, number], TimeEntryRow>(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `);

		const entries = stmt.all(startDate, endDate);
		return entries.map((entry) => this.convertToTimeEntry(entry));
	}

	// Close database connection
	close(): void {
		if (this.db) {
			this.db.close();
		}
	}

	// Import time entries from CSV data
	importTimeEntries(entries: TimeEntryImport[]): void {
		const stmt = this.db.prepare<
			[string, string, number, number | null, number, number, number]
		>(`
      INSERT INTO time_entries (id, task_name, start_time, end_time, created_at, updated_at, logged)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

		const now = Date.now();
		const existingIds = new Set(
			this.getAllTimeEntriesForExport().map((entry) => entry.id),
		);
		const insertMany = this.db.transaction((rows: typeof entries) => {
			for (const entry of rows) {
				const taskName =
					entry.taskName.trim() === '' ? '(untitled)' : entry.taskName;
				const createdAt = entry.createdAt ?? now;
				const updatedAt = entry.updatedAt ?? createdAt;
				const logged = entry.logged ? 1 : 0;
				let entryId = normalizeImportedEntryId(entry.id);
				if (!entryId || existingIds.has(entryId)) {
					entryId = createCuid();
				}
				existingIds.add(entryId);
				stmt.run(
					entryId,
					taskName,
					entry.startTime,
					entry.endTime,
					createdAt,
					updatedAt,
					logged,
				);
			}
		});

		insertMany(entries);
	}

	// Create a safe backup using the built-in SQLite backup API
	async backupTo(destinationPath: string): Promise<void> {
		await this.db.backup(destinationPath);
	}

	// Get database info for debugging
	getInfo(): { path: string; isOpen: boolean; environment: string } {
		return {
			path: this.dbPath,
			isOpen: this.db.open,
			environment: this.environment,
		};
	}
}
