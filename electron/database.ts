import initSqlJs from 'sql.js';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
}

export class DatabaseService {
  private db: any;
  private dbPath: string;
  private SQL: any;
  private initPromise: Promise<void>;

  constructor() {
    // Create user data directory if it doesn't exist
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.dbPath = path.join(userDataPath, 'chronii.db');
    this.initPromise = this.initializeDatabase();
  }

  async waitForInitialization(): Promise<void> {
    await this.initPromise;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.SQL = await initSqlJs();
      
      // Load existing database if it exists
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(data);
      } else {
        this.db = new this.SQL.Database();
      }

      // Create time_entries table
      this.db.run(`
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
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);

      // Save to disk
      this.saveDatabase();

      console.log('Database initialized at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private saveDatabase(): void {
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, data);
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  // Create a new time entry
  createTimeEntry(taskName: string, startTime: number): TimeEntry {
    const now = Date.now();
    this.db.run(`
      INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [taskName, startTime, now, now]);
    
    this.saveDatabase();
    
    // Get the last inserted row
    const result = this.db.exec(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    return this.rowToTimeEntry(result[0].values[0]);
  }

  // Get a time entry by ID
  getTimeEntry(id: number): TimeEntry | null {
    const result = this.db.exec(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries WHERE id = ?
    `, [id]);
    
    if (!result[0] || !result[0].values[0]) {
      return null;
    }
    
    return this.rowToTimeEntry(result[0].values[0]);
  }

  // Update time entry end time (stop timer)
  stopTimeEntry(id: number, endTime: number): TimeEntry | null {
    this.db.run(`
      UPDATE time_entries 
      SET end_time = ?, updated_at = ?
      WHERE id = ? AND end_time IS NULL
    `, [endTime, Date.now(), id]);
    
    this.saveDatabase();
    
    return this.getTimeEntry(id);
  }

  // Get active (running) time entry
  getActiveTimeEntry(): TimeEntry | null {
    const result = this.db.exec(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    `);
    
    if (!result[0] || !result[0].values[0]) {
      return null;
    }
    
    return this.rowToTimeEntry(result[0].values[0]);
  }

  // Get all time entries (for history)
  getAllTimeEntries(limit: number = 100, offset: number = 0): TimeEntry[] {
    const result = this.db.exec(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    if (!result[0]) {
      return [];
    }
    
    return result[0].values.map(row => this.rowToTimeEntry(row));
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
    
    this.db.run(`
      UPDATE time_entries 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);
    
    this.saveDatabase();
    
    return this.getTimeEntry(id);
  }

  // Delete time entry
  deleteTimeEntry(id: number): boolean {
    const result = this.db.exec('SELECT COUNT(*) FROM time_entries WHERE id = ?', [id]);
    const exists = result[0]?.values[0]?.[0] > 0;
    
    if (!exists) {
      return false;
    }
    
    this.db.run('DELETE FROM time_entries WHERE id = ?', [id]);
    this.saveDatabase();
    
    return true;
  }

  // Get time entries for a specific date range
  getTimeEntriesInRange(startDate: number, endDate: number): TimeEntry[] {
    const result = this.db.exec(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `, [startDate, endDate]);
    
    if (!result[0]) {
      return [];
    }
    
    return result[0].values.map(row => this.rowToTimeEntry(row));
  }

  // Helper method to convert database row to TimeEntry object
  private rowToTimeEntry(row: any[]): TimeEntry {
    return {
      id: row[0],
      taskName: row[1],
      startTime: row[2],
      endTime: row[3],
      createdAt: row[4],
      updatedAt: row[5]
    };
  }

  // Close database connection
  close(): void {
    this.saveDatabase();
    if (this.db) {
      this.db.close();
    }
  }

  // Get database info for debugging
  getInfo(): { path: string; isOpen: boolean } {
    return {
      path: this.dbPath,
      isOpen: !!this.db
    };
  }
}

// Singleton instance
let dbInstance: DatabaseService | null = null;
let dbInitPromise: Promise<DatabaseService> | null = null;

export async function getDatabase(): Promise<DatabaseService> {
  if (!dbInstance) {
    if (!dbInitPromise) {
      dbInitPromise = initializeDatabase();
    }
    dbInstance = await dbInitPromise;
  }
  return dbInstance;
}

async function initializeDatabase(): Promise<DatabaseService> {
  const service = new DatabaseService();
  await service.waitForInitialization();
  return service;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}