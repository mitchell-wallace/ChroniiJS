var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath as fileURLToPath$1 } from "node:url";
import path$1 from "node:path";
import initSqlJs from "sql.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);
class DatabaseService {
  constructor() {
    __publicField(this, "db");
    __publicField(this, "dbPath");
    __publicField(this, "SQL");
    __publicField(this, "initPromise");
    const userDataPath = app.getPath("userData");
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    this.dbPath = path.join(userDataPath, "chronii.db");
    this.initPromise = this.initializeDatabase();
  }
  async waitForInitialization() {
    await this.initPromise;
  }
  async initializeDatabase() {
    try {
      this.SQL = await initSqlJs();
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(data);
      } else {
        this.db = new this.SQL.Database();
      }
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
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time);`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_time_entries_task_name ON time_entries(task_name);`);
      this.saveDatabase();
      console.log("Database initialized at:", this.dbPath);
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }
  saveDatabase() {
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, data);
    } catch (error) {
      console.error("Failed to save database:", error);
    }
  }
  // Create a new time entry
  createTimeEntry(taskName, startTime) {
    const now = Date.now();
    this.db.run(`
      INSERT INTO time_entries (task_name, start_time, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `, [taskName, startTime, now, now]);
    this.saveDatabase();
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
  getTimeEntry(id) {
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
  stopTimeEntry(id, endTime) {
    this.db.run(`
      UPDATE time_entries 
      SET end_time = ?, updated_at = ?
      WHERE id = ? AND end_time IS NULL
    `, [endTime, Date.now(), id]);
    this.saveDatabase();
    return this.getTimeEntry(id);
  }
  // Get active (running) time entry
  getActiveTimeEntry() {
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
  getAllTimeEntries(limit = 100, offset = 0) {
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
    return result[0].values.map((row) => this.rowToTimeEntry(row));
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
    this.db.run(`
      UPDATE time_entries 
      SET ${fields.join(", ")}
      WHERE id = ?
    `, values);
    this.saveDatabase();
    return this.getTimeEntry(id);
  }
  // Delete time entry
  deleteTimeEntry(id) {
    var _a, _b;
    const result = this.db.exec("SELECT COUNT(*) FROM time_entries WHERE id = ?", [id]);
    const exists = ((_b = (_a = result[0]) == null ? void 0 : _a.values[0]) == null ? void 0 : _b[0]) > 0;
    if (!exists) {
      return false;
    }
    this.db.run("DELETE FROM time_entries WHERE id = ?", [id]);
    this.saveDatabase();
    return true;
  }
  // Get time entries for a specific date range
  getTimeEntriesInRange(startDate, endDate) {
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
    return result[0].values.map((row) => this.rowToTimeEntry(row));
  }
  // Helper method to convert database row to TimeEntry object
  rowToTimeEntry(row) {
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
  close() {
    this.saveDatabase();
    if (this.db) {
      this.db.close();
    }
  }
  // Get database info for debugging
  getInfo() {
    return {
      path: this.dbPath,
      isOpen: !!this.db
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
  const service = new DatabaseService();
  await service.waitForInitialization();
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
    height: 600,
    minWidth: 320,
    minHeight: 400,
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
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
