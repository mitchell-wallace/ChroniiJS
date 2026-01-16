import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import { getDatabase } from './database-factory';
import type { TimeEntry } from './database-better-sqlite3';
import { createManualBackup, listBackups, restoreBackup, exportDatabase, importDatabase } from './backup-service';
import { getConfig, setConfig, updateConfig, getDefaultBackupDirectory } from './config-store';

export function registerIpcHandlers(): void {

  // Timer operations
  ipcMain.handle('timer:start', async (_, taskName: string): Promise<TimeEntry> => {
    const db = await getDatabase();
    // Stop any active timer first
    const activeEntry = db.getActiveTimeEntry();
    if (activeEntry) {
      db.stopTimeEntry(activeEntry.id, Date.now());
    }
    
    // Start new timer
    return db.createTimeEntry(taskName, Date.now());
  });

  ipcMain.handle('timer:stop', async (_, id: number): Promise<TimeEntry | null> => {
    const db = await getDatabase();
    return db.stopTimeEntry(id, Date.now());
  });

  ipcMain.handle('timer:get-active', async (): Promise<TimeEntry | null> => {
    const db = await getDatabase();
    return db.getActiveTimeEntry();
  });

  // Time entry CRUD operations
  ipcMain.handle('entries:get-all', async (_, limit?: number, offset?: number): Promise<TimeEntry[]> => {
    const db = await getDatabase();
    return db.getAllTimeEntries(limit, offset);
  });

  ipcMain.handle('entries:get-by-id', async (_, id: number): Promise<TimeEntry | null> => {
    const db = await getDatabase();
    return db.getTimeEntry(id);
  });

  ipcMain.handle('entries:update', async (_, id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>>): Promise<TimeEntry | null> => {
    const db = await getDatabase();
    return db.updateTimeEntry(id, updates);
  });

  ipcMain.handle('entries:delete', async (_, id: number): Promise<boolean> => {
    const db = await getDatabase();
    return db.deleteTimeEntry(id);
  });

  ipcMain.handle('entries:get-range', async (_, startDate: number, endDate: number): Promise<TimeEntry[]> => {
    const db = await getDatabase();
    return db.getTimeEntriesInRange(startDate, endDate);
  });

  // Database info
  ipcMain.handle('db:info', async (): Promise<{ path: string; isOpen: boolean }> => {
    const db = await getDatabase();
    return db.getInfo();
  });

  // Config operations
  ipcMain.handle('config:get', async () => {
    return getConfig();
  });

  ipcMain.handle('config:set', async (_, config) => {
    return setConfig(config);
  });

  ipcMain.handle('config:update', async (_, updates) => {
    return updateConfig(updates);
  });

  // Backup operations
  ipcMain.handle('backup:create', async () => {
    return createManualBackup();
  });

  ipcMain.handle('backup:list', async () => {
    return listBackups();
  });

  ipcMain.handle('backup:restore', async (_, backupPath: string) => {
    await restoreBackup(backupPath);
    return true;
  });

  ipcMain.handle('backup:select-location', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getDefaultBackupDirectory(),
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('backup:select-restore-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Chronii Backups', extensions: ['bak'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Database export/import
  ipcMain.handle('db:export', async (_, destinationPath: string) => {
    await exportDatabase(destinationPath);
    return true;
  });

  ipcMain.handle('db:import', async (_, sourcePath: string) => {
    await importDatabase(sourcePath);
    return true;
  });

  ipcMain.handle('db:select-export-path', async (_, suggestedName?: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName ?? 'chronii-database.db',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('db:select-import-path', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('shell:open-path', async (_, targetPath: string) => {
    await shell.openPath(targetPath);
    return true;
  });

  // Window control operations
  ipcMain.handle('window:minimize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.minimize();
    }
  });

  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.close();
    }
  });

  ipcMain.handle('window:is-maximized', async (): Promise<boolean> => {
    const win = BrowserWindow.getFocusedWindow();
    return win ? win.isMaximized() : false;
  });

  // View operations
  ipcMain.handle('view:reload', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.reload();
    }
  });

  ipcMain.handle('view:force-reload', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.reloadIgnoringCache();
    }
  });

  ipcMain.handle('view:dev-tools', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  ipcMain.handle('view:zoom-in', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const currentLevel = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(currentLevel + 1);
    }
  });

  ipcMain.handle('view:zoom-out', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const currentLevel = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(currentLevel - 1);
    }
  });

  ipcMain.handle('view:zoom-reset', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.setZoomLevel(0);
    }
  });

  console.log('IPC handlers registered');
}