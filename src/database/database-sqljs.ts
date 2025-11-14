import type { Database as SqlJsDatabase } from 'sql.js';
import * as SqlJs from 'sql.js';

export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}

export interface IDatabaseService {
  createTimeEntry(taskName: string, startTime: number): TimeEntry;
  getTimeEntry(id: number): TimeEntry | null;
  stopTimeEntry(id: number, endTime: number): TimeEntry | null;
  getActiveTimeEntry(): TimeEntry | null;
  getAllTimeEntries(limit?: number, offset?: number): TimeEntry[];
  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>): TimeEntry | null;
  deleteTimeEntry(id: number): boolean;
  getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[];
  close(): void;
  getInfo(): { path: string; isOpen: boolean };
  export(): Uint8Array;
}

export class SqlJsDatabaseService implements IDatabaseService {
  private db: SqlJsDatabase | null = null;
  // Used for async initialization tracking
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

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
      let SQL: any;

      if (typeof window === 'undefined') {
        // Node.js environment (for tests) - use the sql.js module and a local wasm binary
        const sqlModule: any = SqlJs as any;
        let init: any;

        if (typeof sqlModule === 'function') {
          init = sqlModule;
        } else if (typeof sqlModule.default === 'function') {
          init = sqlModule.default;
        } else if (typeof sqlModule.initSqlJs === 'function') {
          init = sqlModule.initSqlJs;
        } else {
          throw new Error('sql.js init function not found in Node environment');
        }

        const fs = await import('fs');
        const path = await import('path');
        const wasmBinary = fs.readFileSync(
          path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
        ) as unknown as ArrayBuffer;
        SQL = await init({
          wasmBinary,
        });
      } else {
        // Browser environment - use global initSqlJs loaded via local script asset
        const globalInit = (window as any).initSqlJs;
        if (typeof globalInit !== 'function') {
          throw new Error('window.initSqlJs is not a function. Ensure /sql-wasm.js is loaded in index.html');
        }
        SQL = await globalInit({
          // sql-wasm.js expects the wasm beside it as sql-wasm.wasm; we serve both from /.
          locateFile: (_file: string) => `/sql-wasm.wasm`,
        });
      }

      // Try to load from localStorage
      const savedData = typeof localStorage !== 'undefined'
        ? localStorage.getItem('chronii-db')
        : null;
      if (savedData) {
        try {
          const buffer = Uint8Array.from(atob(savedData), c => c.charCodeAt(0));
          this.db = new SQL.Database(buffer);
          console.log('Loaded database from localStorage');
        } catch (decodeError) {
          console.warn('Invalid chronii-db in localStorage, resetting database:', decodeError);
          try {
            localStorage.removeItem('chronii-db');
          } catch {
            // ignore storage removal errors
          }
          this.db = new SQL.Database();
          console.log('Created new sql.js database after clearing corrupt localStorage');
        }
      } else {
        this.db = new SQL.Database();
        console.log('Created new sql.js database');
      }

      this.createTables();
      this.isInitialized = true;

      // Save to localStorage on changes
      this.setupAutoSave();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize sql.js database:', error);
      throw new Error(`sql.js database initialization failed: ${errorMessage}`);
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        logged INTEGER DEFAULT 0
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);
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
    const db = this.db!;
    const originalRun = db.run.bind(db);
    db.run = ((...args: any[]) => {
      const result = (originalRun as any)(...args);
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveToLocalStorage, 2000);
      return result;
    }) as typeof db.run;
  }

  private convertToTimeEntry(row: any): TimeEntry {
    return {
      id: row.id,
      taskName: row.taskName,
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      logged: Boolean(row.logged),
    };
  }

  createTimeEntry(taskName: string, startTime: number): TimeEntry {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    this.db.run(
      `INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [taskName, startTime, now, now]
    );

    const result = this.db.exec(
      `SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries
       WHERE id = last_insert_rowid()`
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error('Failed to create time entry');
    }

    const row = result[0].values[0];
    return this.convertToTimeEntry({
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      logged: row[6],
    });
  }

  getTimeEntry(id: number): TimeEntry | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      `SELECT id, task_name as taskName, start_time as startTime,
              end_time as endTime, created_at as createdAt, updated_at as updatedAt,
              logged
       FROM time_entries WHERE id = ?`,
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.convertToTimeEntry({
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      logged: row[6],
    });
  }

  stopTimeEntry(id: number, endTime: number): TimeEntry | null {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `UPDATE time_entries
       SET end_time = ?, updated_at = ?
       WHERE id = ? AND end_time IS NULL`,
      [endTime, Date.now(), id]
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
       LIMIT 1`
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    return this.convertToTimeEntry({
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      logged: row[6],
    });
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
      [limit, offset]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => this.convertToTimeEntry({
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      logged: row[6],
    }));
  }

  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>): TimeEntry | null {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.taskName !== undefined) {
      fields.push('task_name = ?');
      values.push(updates.taskName);
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
      values
    );

    return this.getTimeEntry(id);
  }

  deleteTimeEntry(id: number): boolean {
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
      [startDate, endDate]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map(row => this.convertToTimeEntry({
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5],
      logged: row[6],
    }));
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
      this.isInitialized = false;
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
