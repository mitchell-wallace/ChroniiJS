var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath as fileURLToPath$1 } from "node:url";
import path$1 from "node:path";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);
class BetterSQLiteDatabaseService {
  constructor() {
    __publicField(this, "db");
    __publicField(this, "dbPath");
    const userDataPath = app.getPath("userData");
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.dbPath = path.join(userDataPath, "chronii.db");
    this.initializeDatabase();
  }
  initializeDatabase() {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
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
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);
      console.log("Better-sqlite3 database initialized at:", this.dbPath);
    } catch (error) {
      console.error("Failed to initialize better-sqlite3 database:", error);
      throw error;
    }
  }
  // Create a new time entry
  createTimeEntry(taskName, startTime) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(taskName, startTime, now, now);
    const selectStmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE id = ?
    `);
    return selectStmt.get(result.lastInsertRowid);
  }
  // Get a time entry by ID
  getTimeEntry(id) {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries WHERE id = ?
    `);
    return stmt.get(id) || null;
  }
  // Update time entry end time (stop timer)
  stopTimeEntry(id, endTime) {
    const stmt = this.db.prepare(`
      UPDATE time_entries 
      SET end_time = ?, updated_at = ?
      WHERE id = ? AND end_time IS NULL
    `);
    stmt.run(endTime, Date.now(), id);
    return this.getTimeEntry(id);
  }
  // Get active (running) time entry
  getActiveTimeEntry() {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    `);
    return stmt.get() || null;
  }
  // Get all time entries (for history)
  getAllTimeEntries(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }
  // Update time entry details
  updateTimeEntry(id, updates) {
    const fields = [];
    const values = [];
    if (updates.taskName !== void 0) {
      fields.push("task_name = ?");
      values.push(updates.taskName);
    }
    if (updates.startTime !== void 0) {
      fields.push("start_time = ?");
      values.push(updates.startTime);
    }
    if (updates.endTime !== void 0) {
      fields.push("end_time = ?");
      values.push(updates.endTime);
    }
    if (fields.length === 0) {
      return this.getTimeEntry(id);
    }
    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE time_entries 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);
    stmt.run(...values);
    return this.getTimeEntry(id);
  }
  // Delete time entry
  deleteTimeEntry(id) {
    const stmt = this.db.prepare("DELETE FROM time_entries WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
  // Get time entries for a specific date range
  getTimeEntriesInRange(startDate, endDate) {
    const stmt = this.db.prepare(`
      SELECT id, task_name as taskName, start_time as startTime, 
             end_time as endTime, created_at as createdAt, updated_at as updatedAt
      FROM time_entries 
      WHERE start_time >= ? AND start_time <= ?
      ORDER BY start_time DESC
    `);
    return stmt.all(startDate, endDate);
  }
  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }
  // Get database info for debugging
  getInfo() {
    return {
      path: this.dbPath,
      isOpen: this.db.open
    };
  }
}
let dbInstance = null;
let dbInitPromise = null;
async function getDatabase() {
  if (!dbInstance) {
    if (!dbInitPromise) {
      dbInitPromise = initializeDatabase();
    }
    dbInstance = await dbInitPromise;
  }
  return dbInstance;
}
async function initializeDatabase() {
  console.log("Initializing better-sqlite3 database...");
  const service = new BetterSQLiteDatabaseService();
  return service;
}
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
  }
}
function registerIpcHandlers() {
  ipcMain.handle("timer:start", async (_, taskName) => {
    const db = await getDatabase();
    const activeEntry = db.getActiveTimeEntry();
    if (activeEntry) {
      db.stopTimeEntry(activeEntry.id, Date.now());
    }
    return db.createTimeEntry(taskName, Date.now());
  });
  ipcMain.handle("timer:stop", async (_, id) => {
    const db = await getDatabase();
    return db.stopTimeEntry(id, Date.now());
  });
  ipcMain.handle("timer:get-active", async () => {
    const db = await getDatabase();
    return db.getActiveTimeEntry();
  });
  ipcMain.handle("entries:get-all", async (_, limit, offset) => {
    const db = await getDatabase();
    return db.getAllTimeEntries(limit, offset);
  });
  ipcMain.handle("entries:get-by-id", async (_, id) => {
    const db = await getDatabase();
    return db.getTimeEntry(id);
  });
  ipcMain.handle("entries:update", async (_, id, updates) => {
    const db = await getDatabase();
    return db.updateTimeEntry(id, updates);
  });
  ipcMain.handle("entries:delete", async (_, id) => {
    const db = await getDatabase();
    return db.deleteTimeEntry(id);
  });
  ipcMain.handle("entries:get-range", async (_, startDate, endDate) => {
    const db = await getDatabase();
    return db.getTimeEntriesInRange(startDate, endDate);
  });
  ipcMain.handle("db:info", async () => {
    const db = await getDatabase();
    return db.getInfo();
  });
  console.log("IPC handlers registered");
}
createRequire(import.meta.url);
const __dirname = path$1.dirname(fileURLToPath$1(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 610,
    minWidth: 320,
    minHeight: 400,
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeDatabase();
    app.quit();
    win = null;
  }
});
app.on("before-quit", () => {
  closeDatabase();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
