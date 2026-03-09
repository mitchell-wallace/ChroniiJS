import type {
	BindParams,
	InitSqlJsStatic,
	Database as SqlJsDatabase,
	SqlJsStatic,
	Statement,
} from 'sql.js';
import * as SqlJs from 'sql.js';
import type {
	PreviewEntrySnapshot,
	TimeEntry,
	TimeEntryUpdate,
} from '../shared/api-types';
import { createCuid, normalizeImportedEntryId } from '../shared/cuid';

export type { TimeEntry };

type TimeEntryImport = Omit<PreviewEntrySnapshot, 'logged'> & {
	logged?: boolean;
};
type TimeEntryRow = [
	string,
	string,
	number,
	number | null,
	number,
	number,
	number,
];
type SqlStatement = Pick<Statement, 'free' | 'run'>;

export interface IDatabaseService {
	createTimeEntry(taskName: string, startTime: number): TimeEntry;
	getTimeEntry(id: string): TimeEntry | null;
	stopTimeEntry(id: string, endTime: number): TimeEntry | null;
	getActiveTimeEntry(): TimeEntry | null;
	getAllTimeEntries(limit?: number, offset?: number): TimeEntry[];
	getAllTimeEntriesForExport(): TimeEntry[];
	updateTimeEntry(id: string, updates: TimeEntryUpdate): TimeEntry | null;
	clearAllEntries(): void;
	deleteEntriesByMatch(entries: PreviewEntrySnapshot[]): void;
	updateEntriesById(entries: TimeEntry[]): void;
	deleteTimeEntry(id: string): boolean;
	getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[];
	importTimeEntries(entries: TimeEntryImport[]): void;
	close(): void;
	getInfo(): { path: string; isOpen: boolean };
	export(): Uint8Array;
}

export class SqlJsDatabaseService implements IDatabaseService {
	private db: SqlJsDatabase | null = null;
	private initPromise: Promise<void> | null = null;
	private sqlModule: SqlJsStatic | null = null;

	constructor() {
		// Initialize asynchronously
		this.initPromise = this.initialize();
	}

	/**
	 * Wait until the underlying sql.js Database is fully initialized.
	 * Useful in environments where we need to guarantee readiness before use
	 * (e.g. web-backend before wiring APIs into window).
	 */
	async waitUntilReady(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise;
		}
	}

	private async initialize(): Promise<void> {
		try {
			// Determine the environment and load sql.js accordingly
			let SQL: SqlJsStatic;

			if (typeof window === 'undefined') {
				// Node.js environment (for tests) - use the sql.js module and a local wasm binary
				const sqlModule = SqlJs as unknown as
					| InitSqlJsStatic
					| {
							default?: InitSqlJsStatic;
							initSqlJs?: InitSqlJsStatic;
					  };
				let init: InitSqlJsStatic | undefined;

				if (typeof sqlModule === 'function') {
					init = sqlModule;
				} else if (typeof sqlModule.default === 'function') {
					init = sqlModule.default;
				} else if (typeof sqlModule.initSqlJs === 'function') {
					init = sqlModule.initSqlJs;
				} else {
					throw new Error('sql.js init function not found in Node environment');
				}

				const fs = await import('node:fs');
				const path = await import('node:path');
				const wasmBinary = fs.readFileSync(
					path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
				);
				const wasmArrayBuffer = wasmBinary.buffer.slice(
					wasmBinary.byteOffset,
					wasmBinary.byteOffset + wasmBinary.byteLength,
				) as ArrayBuffer;
				SQL = await init({
					wasmBinary: wasmArrayBuffer,
				});
			} else {
				// Browser environment - use global initSqlJs loaded via local script asset
				const globalInit = window.initSqlJs;
				if (typeof globalInit !== 'function') {
					throw new Error(
						'window.initSqlJs is not a function. Ensure /sql-wasm.js is loaded in index.html',
					);
				}
				SQL = await globalInit({
					// sql-wasm.js expects the wasm beside it as sql-wasm.wasm; we serve both from /.
					locateFile: (_file: string) => `/sql-wasm.wasm`,
				});
			}

			this.sqlModule = SQL;

			// Try to load from localStorage
			const savedData =
				typeof localStorage !== 'undefined'
					? localStorage.getItem('chronii-db')
					: null;
			if (savedData) {
				try {
					const buffer = Uint8Array.from(atob(savedData), (c) =>
						c.charCodeAt(0),
					);
					this.db = new SQL.Database(buffer);
					console.log('Loaded database from localStorage');
				} catch (decodeError) {
					console.warn(
						'Invalid chronii-db in localStorage, resetting database:',
						decodeError,
					);
					try {
						localStorage.removeItem('chronii-db');
					} catch {
						// ignore storage removal errors
					}
					this.db = new SQL.Database();
					console.log(
						'Created new sql.js database after clearing corrupt localStorage',
					);
				}
			} else {
				this.db = new SQL.Database();
				console.log('Created new sql.js database');
			}

			this.ensureSchema();

			// Save to localStorage on changes
			this.setupAutoSave();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error('Failed to initialize sql.js database:', error);
			throw new Error(`sql.js database initialization failed: ${errorMessage}`);
		}
	}

	importFromBuffer(data: Uint8Array): void {
		if (!this.sqlModule) {
			throw new Error('SQL module not initialized');
		}

		if (this.db) {
			this.db.close();
		}

		this.db = new this.sqlModule.Database(data);
		this.ensureSchema();
		this.setupAutoSave();

		try {
			const base64 = btoa(String.fromCharCode(...data));
			localStorage.setItem('chronii-db', base64);
		} catch (error) {
			console.warn(
				'Failed to persist imported database to localStorage:',
				error,
			);
		}
	}

	private ensureSchema(): void {
		if (!this.db) throw new Error('Database not initialized');

		const tableInfo = this.db.exec(`PRAGMA table_info(time_entries)`);
		const columns = tableInfo[0]?.values ?? [];
		if (columns.length === 0) {
			this.createTables();
			return;
		}

		const hasLogged = columns.some((row) => String(row[1]) === 'logged');
		const idColumn = columns.find((row) => String(row[1]) === 'id');
		const hasTextId =
			idColumn !== undefined &&
			String(idColumn[2] ?? '')
				.toUpperCase()
				.includes('TEXT');

		if (hasLogged && hasTextId) {
			this.createTables();
			return;
		}

		const legacyRows = this.db.exec(
			hasLogged
				? `SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt, logged
           FROM time_entries
           ORDER BY created_at ASC, start_time ASC`
				: `SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt, 0 as logged
           FROM time_entries
           ORDER BY created_at ASC, start_time ASC`,
		)[0]?.values as Array<
			[unknown, string, number, number | null, number, number, number]
		>;

		this.db.run('BEGIN TRANSACTION');
		try {
			this.db.run('ALTER TABLE time_entries RENAME TO time_entries_legacy');
			this.createTables();

			const insert = this.db.prepare(`
        INSERT INTO time_entries (id, task_name, start_time, end_time, created_at, updated_at, logged)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `) as SqlStatement;

			for (const row of legacyRows ?? []) {
				insert.run([
					createCuid(),
					String(row[1] ?? ''),
					Number(row[2]),
					row[3] === null ? null : Number(row[3]),
					Number(row[4]),
					Number(row[5]),
					Number(row[6]) ? 1 : 0,
				]);
			}

			insert.free();
			this.db.run('DROP TABLE time_entries_legacy');
			this.db.run('COMMIT');
		} catch (error) {
			this.db.run('ROLLBACK');
			throw error;
		}
	}

	private createTables(): void {
		if (!this.db) throw new Error('Database not initialized');

		this.db.run(`
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

		this.db.run(
			`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`,
		);
		this.db.run(
			`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`,
		);
	}

	private setupAutoSave(): void {
		// Save to localStorage every 2 seconds after changes
		let saveTimeout: ReturnType<typeof setTimeout> | null = null;

		const saveToLocalStorage = () => {
			if (!this.db) return;
			try {
				const data = this.db.export();
				const base64 = btoa(String.fromCharCode(...data));
				localStorage.setItem('chronii-db', base64);
			} catch (error) {
				console.error('Failed to save database to localStorage:', error);
			}
		};

		// Override exec and run to trigger saves
		const db = this.db;
		if (!db) {
			return;
		}
		const originalRun = db.run.bind(db);
		db.run = ((sql: string, params?: BindParams) => {
			const result = originalRun(sql, params);
			if (saveTimeout) clearTimeout(saveTimeout);
			saveTimeout = setTimeout(saveToLocalStorage, 2000);
			return result;
		}) as typeof db.run;
	}

	private convertToTimeEntry(row: TimeEntryRow): TimeEntry {
		return {
			id: String(row[0]),
			taskName: String(row[1]),
			startTime: Number(row[2]),
			endTime: row[3] === null ? null : Number(row[3]),
			createdAt: Number(row[4]),
			updatedAt: Number(row[5]),
			logged: Boolean(row[6]),
		};
	}

	createTimeEntry(taskName: string, startTime: number): TimeEntry {
		if (!this.db) throw new Error('Database not initialized');

		const now = Date.now();
		const id = createCuid();
		const finalTaskName = taskName.trim() === '' ? '(untitled)' : taskName;
		this.db.run(
			`INSERT INTO time_entries (id, task_name, start_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
			[id, finalTaskName, startTime, now, now],
		);

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       WHERE id = ?`,
			[id],
		);

		if (result.length === 0 || result[0].values.length === 0) {
			throw new Error('Failed to create time entry');
		}

		const row = result[0].values[0] as TimeEntryRow;
		return this.convertToTimeEntry(row);
	}

	getTimeEntry(id: string): TimeEntry | null {
		if (!this.db) throw new Error('Database not initialized');

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries WHERE id = ?`,
			[id],
		);

		if (result.length === 0 || result[0].values.length === 0) {
			return null;
		}

		const row = result[0].values[0] as TimeEntryRow;
		return this.convertToTimeEntry(row);
	}

	stopTimeEntry(id: string, endTime: number): TimeEntry | null {
		if (!this.db) throw new Error('Database not initialized');

		this.db.run(
			`UPDATE time_entries
       SET end_time = ?, updated_at = ?
       WHERE id = ? AND end_time IS NULL`,
			[endTime, Date.now(), id],
		);

		return this.getTimeEntry(id);
	}

	getActiveTimeEntry(): TimeEntry | null {
		if (!this.db) throw new Error('Database not initialized');

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       WHERE end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
		);

		if (result.length === 0 || result[0].values.length === 0) {
			return null;
		}

		const row = result[0].values[0] as TimeEntryRow;
		return this.convertToTimeEntry(row);
	}

	getAllTimeEntries(limit: number = 100, offset: number = 0): TimeEntry[] {
		if (!this.db) throw new Error('Database not initialized');

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       ORDER BY start_time DESC
       LIMIT ? OFFSET ?`,
			[limit, offset],
		);

		if (result.length === 0) {
			return [];
		}

		return result[0].values.map((row) =>
			this.convertToTimeEntry(row as TimeEntryRow),
		);
	}

	getAllTimeEntriesForExport(): TimeEntry[] {
		if (!this.db) throw new Error('Database not initialized');

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       ORDER BY start_time DESC`,
		);

		if (result.length === 0) {
			return [];
		}

		return result[0].values.map((row) =>
			this.convertToTimeEntry(row as TimeEntryRow),
		);
	}

	updateTimeEntry(id: string, updates: TimeEntryUpdate): TimeEntry | null {
		if (!this.db) throw new Error('Database not initialized');

		const fields: string[] = [];
		const values: Array<number | string | null> = [];

		if (updates.taskName !== undefined) {
			fields.push('task_name = ?');
			values.push(
				updates.taskName.trim() === '' ? '(untitled)' : updates.taskName,
			);
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

		this.db.run(
			`UPDATE time_entries
       SET ${fields.join(', ')}
       WHERE id = ?`,
			values,
		);

		return this.getTimeEntry(id);
	}

	clearAllEntries(): void {
		if (!this.db) throw new Error('Database not initialized');
		this.db.run('DELETE FROM time_entries');
	}

	deleteEntriesByMatch(entries: PreviewEntrySnapshot[]): void {
		if (!this.db) throw new Error('Database not initialized');

		const stmtWithEnd = this.db.prepare(`
      DELETE FROM time_entries
      WHERE task_name = ? AND start_time = ? AND end_time = ? AND created_at = ? AND updated_at = ? AND logged = ?
    `) as SqlStatement;
		const stmtNoEnd = this.db.prepare(`
      DELETE FROM time_entries
      WHERE task_name = ? AND start_time = ? AND end_time IS NULL AND created_at = ? AND updated_at = ? AND logged = ?
    `) as SqlStatement;
		const stmtById = this.db.prepare(
			'DELETE FROM time_entries WHERE id = ?',
		) as SqlStatement;

		this.db.run('BEGIN TRANSACTION');
		try {
			for (const entry of entries) {
				const logged = entry.logged ? 1 : 0;
				if (entry.id !== undefined) {
					stmtById.run([entry.id]);
				} else if (entry.endTime === null) {
					stmtNoEnd.run([
						entry.taskName,
						entry.startTime,
						entry.createdAt,
						entry.updatedAt,
						logged,
					]);
				} else {
					stmtWithEnd.run([
						entry.taskName,
						entry.startTime,
						entry.endTime,
						entry.createdAt,
						entry.updatedAt,
						logged,
					]);
				}
			}
			this.db.run('COMMIT');
		} catch (error) {
			this.db.run('ROLLBACK');
			throw error;
		} finally {
			stmtWithEnd.free();
			stmtNoEnd.free();
			stmtById.free();
		}
	}

	updateEntriesById(entries: TimeEntry[]): void {
		if (!this.db) throw new Error('Database not initialized');

		const stmt = this.db.prepare(`
      UPDATE time_entries
      SET task_name = ?, start_time = ?, end_time = ?, created_at = ?, updated_at = ?, logged = ?
      WHERE id = ?
    `) as SqlStatement;

		this.db.run('BEGIN TRANSACTION');
		try {
			for (const entry of entries) {
				stmt.run([
					entry.taskName,
					entry.startTime,
					entry.endTime,
					entry.createdAt,
					entry.updatedAt,
					entry.logged ? 1 : 0,
					entry.id,
				]);
			}
			this.db.run('COMMIT');
		} catch (error) {
			this.db.run('ROLLBACK');
			throw error;
		} finally {
			stmt.free();
		}
	}

	deleteTimeEntry(id: string): boolean {
		if (!this.db) throw new Error('Database not initialized');

		this.db.run('DELETE FROM time_entries WHERE id = ?', [id]);

		// Check if row was deleted by checking if it still exists
		const result = this.db.exec('SELECT changes()');
		return result.length > 0 && Number(result[0].values[0][0]) > 0;
	}

	getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[] {
		if (!this.db) throw new Error('Database not initialized');

		const result = this.db.exec(
			`SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       WHERE start_time >= ? AND start_time <= ?
       ORDER BY start_time DESC`,
			[startDate, endDate],
		);

		if (result.length === 0) {
			return [];
		}

		return result[0].values.map((row) =>
			this.convertToTimeEntry(row as TimeEntryRow),
		);
	}

	close(): void {
		if (this.db) {
			// Save one last time before closing
			try {
				const data = this.db.export();
				const base64 = btoa(String.fromCharCode(...data));
				localStorage.setItem('chronii-db', base64);
			} catch (error) {
				console.error('Failed to save database before closing:', error);
			}
			this.db.close();
			this.db = null;
		}
	}

	importTimeEntries(entries: TimeEntryImport[]): void {
		if (!this.db) throw new Error('Database not initialized');

		const stmt = this.db.prepare(`
      INSERT INTO time_entries (id, task_name, start_time, end_time, created_at, updated_at, logged)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `) as SqlStatement;

		const now = Date.now();
		const existingIds = new Set(
			this.getAllTimeEntriesForExport().map((entry) => entry.id),
		);
		this.db.run('BEGIN TRANSACTION');
		try {
			for (const entry of entries) {
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
				stmt.run([
					entryId,
					taskName,
					entry.startTime,
					entry.endTime,
					createdAt,
					updatedAt,
					logged,
				]);
			}
			this.db.run('COMMIT');
		} catch (error) {
			this.db.run('ROLLBACK');
			throw error;
		} finally {
			stmt.free();
		}
	}

	getInfo(): { path: string; isOpen: boolean } {
		return {
			path: 'localStorage://chronii-db',
			isOpen: this.db !== null,
		};
	}

	export(): Uint8Array {
		if (!this.db) throw new Error('Database not initialized');
		return this.db.export();
	}
}
