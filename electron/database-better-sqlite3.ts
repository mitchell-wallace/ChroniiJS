import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
}

export class BetterSQLiteDatabaseService {
  private db!: Database.Database;
  private dbPath: string;

  constructor() {
    // Create user data directory if it doesn't exist
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.dbPath = path.join(userDataPath, 'chronii.db');
    this.initializeDatabase();
  }

  // Helper to convert SQLite integer to boolean for logged field
  private convertToTimeEntry(row: any): TimeEntry {
    if (!row) return null as any;
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
      
      // Create time_entries table
      this.db.exec(`
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

      // Migration: Add logged column to existing tables
      try {
        this.db.exec(`ALTER TABLE time_entries ADD COLUMN logged INTEGER DEFAULT 0;`);
      } catch (error) {
        // Column already exists, ignore the error
      }

      // Create indexes
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);

      console.log('Better-sqlite3 database initialized at:', this.dbPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to initialize better-sqlite3 database:', error);
      console.error('Database path:', this.dbPath);
      console.error('User data path:', app.getPath('userData'));
      
      // Enhanced error for better debugging
      throw new Error(`Database initialization failed: ${errorMessage}\nPath: ${this.dbPath}\nThis usually means better-sqlite3 native module isn't properly built for your platform.`);
    }
  }

  // Create a new time entry
  createTimeEntry(taskName: string, startTime: number): TimeEntry {
    try {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(taskName, startTime, now, now);
      
      // Get the inserted entry
      const selectStmt = this.db.prepare(`
        SELECT id, task_name as taskName, start_time as startTime,
               end_time as endTime, created_at as createdAt, updated_at as updatedAt,
               logged
        FROM time_entries
        WHERE id = ?
      `);

      const entry = selectStmt.get(result.lastInsertRowid) as any;
      return this.convertToTimeEntry(entry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to create time entry:', error);
      throw new Error(`Failed to create time entry "${taskName}": ${errorMessage}`);
    }
  }

  // Get a time entry by ID
  getTimeEntry(id: number): TimeEntry | null {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries WHERE id = ?
    `);

    const entry = stmt.get(id) as any;
    return entry ? this.convertToTimeEntry(entry) : null;
  }

  // Update time entry end time (stop timer)
  stopTimeEntry(id: number, endTime: number): TimeEntry | null {
    const stmt = this.db.prepare(`
      UPDATE time_entries 
      SET end_time = ?, updated_at = ?
      WHERE id = ? AND end_time IS NULL
    `);
    
    stmt.run(endTime, Date.now(), id);
    return this.getTimeEntry(id);
  }

  // Get active (running) time entry
  getActiveTimeEntry(): TimeEntry | null {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      WHERE end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `);

    const entry = stmt.get() as any;
    return entry ? this.convertToTimeEntry(entry) : null;
  }

  // Get all time entries (for history)
  getAllTimeEntries(limit: number = 100, offset: number = 0): TimeEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      ORDER BY start_time DESC
      LIMIT ? OFFSET ?
    `);

    const entries = stmt.all(limit, offset) as any[];
    return entries.map(entry => this.convertToTimeEntry(entry));
  }

  // Update time entry details
  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>): TimeEntry | null {
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
    
    const stmt = this.db.prepare(`
      UPDATE time_entries 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getTimeEntry(id);
  }

  // Delete time entry
  deleteTimeEntry(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM time_entries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Get time entries for a specific date range
  getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime,
             end_time as endTime, created_at as createdAt, updated_at as updatedAt,
             logged
      FROM time_entries
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `);

    const entries = stmt.all(startDate, endDate) as any[];
    return entries.map(entry => this.convertToTimeEntry(entry));
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // Get database info for debugging
  getInfo(): { path: string; isOpen: boolean } {
    return {
      path: this.dbPath,
      isOpen: this.db.open
    };
  }
}