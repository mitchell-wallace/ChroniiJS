import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webBackend, initializeWebBackend, resetDatabaseForTests } from '../../src/database/web-backend';
import type { TimeEntry } from '../../src/database/database-sqljs';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as any;

// Mock window.btoa and window.atob
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

describe('Web Backend Integration Tests', () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset the database singleton
    resetDatabaseForTests();

    // Initialize web backend
    await initializeWebBackend();

    // Wait a bit for full initialization
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(() => {
    // Reset database after each test
    resetDatabaseForTests();
    localStorage.clear();
  });

  describe('Timer Operations', () => {
    it('should start a timer', async () => {
      const taskName = 'Test Task';
      const entry = await webBackend.timerAPI.startTimer(taskName);

      expect(entry).toBeDefined();
      expect(entry.taskName).toBe(taskName);
      expect(entry.startTime).toBeGreaterThan(0);
      expect(entry.endTime).toBeNull();
    });

    it('should stop active timer when starting new timer', async () => {
      // Start first timer
      const entry1 = await webBackend.timerAPI.startTimer('Task 1');
      expect(entry1.endTime).toBeNull();

      // Start second timer
      const entry2 = await webBackend.timerAPI.startTimer('Task 2');
      expect(entry2.endTime).toBeNull();

      // Check first timer was stopped
      const stoppedEntry = await webBackend.entriesAPI.getEntryById(entry1.id);
      expect(stoppedEntry?.endTime).not.toBeNull();
    });

    it('should stop a timer', async () => {
      const entry = await webBackend.timerAPI.startTimer('Test Task');
      const stopped = await webBackend.timerAPI.stopTimer(entry.id);

      expect(stopped).not.toBeNull();
      expect(stopped!.endTime).toBeGreaterThan(0);
    });

    it('should get active timer', async () => {
      await webBackend.timerAPI.startTimer('Active Task');
      const active = await webBackend.timerAPI.getActiveTimer();

      expect(active).not.toBeNull();
      expect(active!.taskName).toBe('Active Task');
      expect(active!.endTime).toBeNull();
    });

    it('should return null for active timer when none exists', async () => {
      const active = await webBackend.timerAPI.getActiveTimer();
      expect(active).toBeNull();
    });
  });

  describe('Entry CRUD Operations', () => {
    it('should get all entries', async () => {
      // Create some entries
      await webBackend.timerAPI.startTimer('Task 1');
      await webBackend.timerAPI.startTimer('Task 2');
      await webBackend.timerAPI.startTimer('Task 3');

      const entries = await webBackend.entriesAPI.getAllEntries();
      expect(entries).toHaveLength(3);
    });

    it('should get all entries with limit', async () => {
      // Create some entries
      await webBackend.timerAPI.startTimer('Task 1');
      await webBackend.timerAPI.startTimer('Task 2');
      await webBackend.timerAPI.startTimer('Task 3');

      const entries = await webBackend.entriesAPI.getAllEntries(2);
      expect(entries).toHaveLength(2);
    });

    it('should get entry by ID', async () => {
      const created = await webBackend.timerAPI.startTimer('Test Task');
      const retrieved = await webBackend.entriesAPI.getEntryById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.taskName).toBe('Test Task');
    });

    it('should return null for non-existent entry ID', async () => {
      const retrieved = await webBackend.entriesAPI.getEntryById(99999);
      expect(retrieved).toBeNull();
    });

    it('should update entry', async () => {
      const entry = await webBackend.timerAPI.startTimer('Original Task');
      const updated = await webBackend.entriesAPI.updateEntry(entry.id, {
        taskName: 'Updated Task',
      });

      expect(updated).not.toBeNull();
      expect(updated!.taskName).toBe('Updated Task');
    });

    it('should update multiple fields', async () => {
      const entry = await webBackend.timerAPI.startTimer('Test Task');
      const newStart = Date.now() + 1000;
      const endTime = Date.now() + 5000;

      const updated = await webBackend.entriesAPI.updateEntry(entry.id, {
        taskName: 'Updated Task',
        startTime: newStart,
        endTime: endTime,
      });

      expect(updated!.taskName).toBe('Updated Task');
      expect(updated!.startTime).toBe(newStart);
      expect(updated!.endTime).toBe(endTime);
    });

    it('should delete entry', async () => {
      const entry = await webBackend.timerAPI.startTimer('Task to Delete');
      const deleted = await webBackend.entriesAPI.deleteEntry(entry.id);

      expect(deleted).toBe(true);

      const retrieved = await webBackend.entriesAPI.getEntryById(entry.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent entry', async () => {
      const deleted = await webBackend.entriesAPI.deleteEntry(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('Range Query Operations', () => {
    it('should get entries in range', async () => {
      const now = Date.now();

      // Create entries with specific times by updating their start times
      const entry1 = await webBackend.timerAPI.startTimer('Task 1');
      await webBackend.entriesAPI.updateEntry(entry1.id, { startTime: now - 10000 });

      const entry2 = await webBackend.timerAPI.startTimer('Task 2');
      await webBackend.entriesAPI.updateEntry(entry2.id, { startTime: now - 5000 });

      const entry3 = await webBackend.timerAPI.startTimer('Task 3');
      await webBackend.entriesAPI.updateEntry(entry3.id, { startTime: now });

      const entries = await webBackend.entriesAPI.getEntriesInRange(
        now - 6000,
        now + 1000
      );

      expect(entries).toHaveLength(2);
      expect(entries.some((e: TimeEntry) => e.taskName === 'Task 2')).toBe(true);
      expect(entries.some((e: TimeEntry) => e.taskName === 'Task 3')).toBe(true);
    });

    it('should return empty array for range with no entries', async () => {
      const now = Date.now();
      const entry = await webBackend.timerAPI.startTimer('Task');
      await webBackend.entriesAPI.updateEntry(entry.id, { startTime: now - 10000 });

      const entries = await webBackend.entriesAPI.getEntriesInRange(
        now,
        now + 5000
      );

      expect(entries).toEqual([]);
    });
  });

  describe('Database Info', () => {
    it('should get database info', async () => {
      const info = await webBackend.databaseAPI.getInfo();

      expect(info).toBeDefined();
      expect(info.path).toBe('localStorage://chronii-db');
      expect(info.isOpen).toBe(true);
    });
  });

  describe('Window API (stubs)', () => {
    it('should have stub methods that log warnings', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await webBackend.windowAPI.minimize();
      expect(consoleSpy).toHaveBeenCalledWith('Window minimize not supported in web version');

      await webBackend.windowAPI.maximize();
      expect(consoleSpy).toHaveBeenCalledWith('Window maximize not supported in web version');

      await webBackend.windowAPI.close();
      expect(consoleSpy).toHaveBeenCalledWith('Window close not supported in web version');

      const isMaximized = await webBackend.windowAPI.isMaximized();
      expect(isMaximized).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
