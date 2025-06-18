import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import type { TimeEntry } from './database';

// Create ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BetterSQLiteDatabaseService {
  private db: Database.Database;
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
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );
      `);

      // Create indexes
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);

      console.log('Better-sqlite3 database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize better-sqlite3 database:', error);
      throw error;
    }
  }

  // Create a new time entry
  createTimeEntry(taskName: string, startTime: number): TimeEntry {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(taskName, startTime, now, now);
    
    // Get the inserted entry
    const selectStmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE id = ?
    `);
    
    return selectStmt.get(result.lastInsertRowid) as TimeEntry;
  }

  // Get a time entry by ID
  getTimeEntry(id: number): TimeEntry | null {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries WHERE id = ?
    `);
    
    return stmt.get(id) as TimeEntry || null;
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
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    `);
    
    return stmt.get() as TimeEntry || null;
  }

  // Get all time entries (for history)
  getAllTimeEntries(limit: number = 100, offset: number = 0): TimeEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(limit, offset) as TimeEntry[];
  }

  // Update time entry details
  updateTimeEntry(id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime'>>): TimeEntry | null {
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
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `);
    
    return stmt.all(startDate, endDate) as TimeEntry[];
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