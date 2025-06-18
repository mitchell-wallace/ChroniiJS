import { ipcMain } from 'electron';
import { getDatabase } from './database-factory';
import type { TimeEntry } from './database';

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

  ipcMain.handle('entries:update', async (_, id: number, updates: Partial<Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime'>>): Promise<TimeEntry | null> => {
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

  console.log('IPC handlers registered');
}