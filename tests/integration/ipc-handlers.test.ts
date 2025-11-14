import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain, BrowserWindow } from 'electron';
import { registerIpcHandlers } from '../../electron/ipc-handlers';
import { getDatabase, closeDatabase } from '../../electron/database-factory';
import type { TimeEntry } from '../../electron/database-better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron module
vi.mock('electron', () => {
  const handlers = new Map<string, Function>();

  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return path.join(os.tmpdir(), 'chronii-ipc-test-' + Date.now());
        }
        return os.tmpdir();
      },
    },
    ipcMain: {
      handle: (channel: string, handler: Function) => {
        handlers.set(channel, handler);
      },
      // Helper to invoke handlers for testing
      _invokeHandler: async (channel: string, ...args: any[]) => {
        const handler = handlers.get(channel);
        if (!handler) {
          throw new Error(`No handler registered for ${channel}`);
        }
        return handler({}, ...args);
      },
    },
    BrowserWindow: {
      getFocusedWindow: () => null,
    },
  };
});

describe('IPC Handlers Integration Tests', () => {
  let testDbPath: string;

  beforeEach(async () => {
    // Register handlers before each test
    registerIpcHandlers();

    // Get database info
    const db = await getDatabase();
    const info = db.getInfo();
    testDbPath = info.path;
  });

  afterEach(() => {
    // Clean up database
    closeDatabase();

    // Remove test database file
    try {
      if (testDbPath && fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // Clean up directory if empty
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Timer Operations', () => {
    it('should start a timer', async () => {
      const taskName = 'Test Task';
      const entry = await (ipcMain as any)._invokeHandler('timer:start', taskName);

      expect(entry).toBeDefined();
      expect(entry.taskName).toBe(taskName);
      expect(entry.startTime).toBeGreaterThan(0);
      expect(entry.endTime).toBeNull();
    });

    it('should stop active timer when starting new timer', async () => {
      // Start first timer
      const entry1 = await (ipcMain as any)._invokeHandler('timer:start', 'Task 1');
      expect(entry1.endTime).toBeNull();

      // Start second timer
      const entry2 = await (ipcMain as any)._invokeHandler('timer:start', 'Task 2');
      expect(entry2.endTime).toBeNull();

      // Check first timer was stopped
      const db = await getDatabase();
      const stoppedEntry = db.getTimeEntry(entry1.id);
      expect(stoppedEntry?.endTime).not.toBeNull();
    });

    it('should stop a timer', async () => {
      const entry = await (ipcMain as any)._invokeHandler('timer:start', 'Test Task');
      const stopped = await (ipcMain as any)._invokeHandler('timer:stop', entry.id);

      expect(stopped).not.toBeNull();
      expect(stopped.endTime).toBeGreaterThan(0);
    });

    it('should get active timer', async () => {
      await (ipcMain as any)._invokeHandler('timer:start', 'Active Task');
      const active = await (ipcMain as any)._invokeHandler('timer:get-active');

      expect(active).not.toBeNull();
      expect(active.taskName).toBe('Active Task');
      expect(active.endTime).toBeNull();
    });

    it('should return null for active timer when none exists', async () => {
      const active = await (ipcMain as any)._invokeHandler('timer:get-active');
      expect(active).toBeNull();
    });
  });

  describe('Entry CRUD Operations', () => {
    it('should get all entries', async () => {
      // Create some entries
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 1');
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 2');
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 3');

      const entries = await (ipcMain as any)._invokeHandler('entries:get-all');
      expect(entries).toHaveLength(3);
    });

    it('should get all entries with limit', async () => {
      // Create some entries
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 1');
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 2');
      await (ipcMain as any)._invokeHandler('timer:start', 'Task 3');

      const entries = await (ipcMain as any)._invokeHandler('entries:get-all', 2);
      expect(entries).toHaveLength(2);
    });

    it('should get entry by ID', async () => {
      const created = await (ipcMain as any)._invokeHandler('timer:start', 'Test Task');
      const retrieved = await (ipcMain as any)._invokeHandler('entries:get-by-id', created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.taskName).toBe('Test Task');
    });

    it('should return null for non-existent entry ID', async () => {
      const retrieved = await (ipcMain as any)._invokeHandler('entries:get-by-id', 99999);
      expect(retrieved).toBeNull();
    });

    it('should update entry', async () => {
      const entry = await (ipcMain as any)._invokeHandler('timer:start', 'Original Task');
      const updated = await (ipcMain as any)._invokeHandler('entries:update', entry.id, {
        taskName: 'Updated Task',
      });

      expect(updated).not.toBeNull();
      expect(updated.taskName).toBe('Updated Task');
    });

    it('should update multiple fields', async () => {
      const entry = await (ipcMain as any)._invokeHandler('timer:start', 'Test Task');
      const newStart = Date.now() + 1000;
      const endTime = Date.now() + 5000;

      const updated = await (ipcMain as any)._invokeHandler('entries:update', entry.id, {
        taskName: 'Updated Task',
        startTime: newStart,
        endTime: endTime,
      });

      expect(updated.taskName).toBe('Updated Task');
      expect(updated.startTime).toBe(newStart);
      expect(updated.endTime).toBe(endTime);
    });

    it('should delete entry', async () => {
      const entry = await (ipcMain as any)._invokeHandler('timer:start', 'Task to Delete');
      const deleted = await (ipcMain as any)._invokeHandler('entries:delete', entry.id);

      expect(deleted).toBe(true);

      const retrieved = await (ipcMain as any)._invokeHandler('entries:get-by-id', entry.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent entry', async () => {
      const deleted = await (ipcMain as any)._invokeHandler('entries:delete', 99999);
      expect(deleted).toBe(false);
    });
  });

  describe('Range Query Operations', () => {
    it('should get entries in range', async () => {
      const now = Date.now();

      // Create entries with specific times
      const db = await getDatabase();
      db.createTimeEntry('Task 1', now - 10000); // 10s ago
      db.createTimeEntry('Task 2', now - 5000);  // 5s ago
      db.createTimeEntry('Task 3', now);         // now

      const entries = await (ipcMain as any)._invokeHandler(
        'entries:get-range',
        now - 6000,
        now + 1000
      );

      expect(entries).toHaveLength(2);
      expect(entries.some((e: TimeEntry) => e.taskName === 'Task 2')).toBe(true);
      expect(entries.some((e: TimeEntry) => e.taskName === 'Task 3')).toBe(true);
    });

    it('should return empty array for range with no entries', async () => {
      const now = Date.now();
      const db = await getDatabase();
      db.createTimeEntry('Task', now - 10000);

      const entries = await (ipcMain as any)._invokeHandler(
        'entries:get-range',
        now,
        now + 5000
      );

      expect(entries).toEqual([]);
    });
  });

  describe('Database Info', () => {
    it('should get database info', async () => {
      const info = await (ipcMain as any)._invokeHandler('db:info');

      expect(info).toBeDefined();
      expect(info.path).toBeTruthy();
      expect(info.isOpen).toBe(true);
    });
  });
});
