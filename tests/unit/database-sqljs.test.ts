import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SqlJsDatabaseService } from '../../src/database/database-sqljs';
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

describe('SqlJsDatabaseService', () => {
  let db: SqlJsDatabaseService;

  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();

    // Create a fresh database instance for each test
    db = new SqlJsDatabaseService();

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(() => {
    // Clean up database
    if (db) {
      db.close();
    }
    localStorage.clear();
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', () => {
      const info = db.getInfo();
      expect(info.isOpen).toBe(true);
      expect(info.path).toBe('localStorage://chronii-db');
    });

    it('should create time_entries table', () => {
      // Try to insert an entry to verify table exists
      const entry = db.createTimeEntry('Test Task', Date.now());
      expect(entry.id).toBeTruthy();
    });
  });

  describe('createTimeEntry', () => {
    it('should create a time entry with correct data', () => {
      const taskName = 'Test Task';
      const startTime = Date.now();

      const entry = db.createTimeEntry(taskName, startTime);

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.taskName).toBe(taskName);
      expect(entry.startTime).toBe(startTime);
      expect(entry.endTime).toBeNull();
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.updatedAt).toBeGreaterThan(0);
      expect(entry.logged).toBe(false);
    });

    it('should create multiple entries with unique IDs', () => {
      const entry1 = db.createTimeEntry('Task 1', Date.now());
      const entry2 = db.createTimeEntry('Task 2', Date.now());

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('getTimeEntry', () => {
    it('should retrieve an existing entry by ID', () => {
      const created = db.createTimeEntry('Test Task', Date.now());
      const retrieved = db.getTimeEntry(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.taskName).toBe(created.taskName);
    });

    it('should return null for non-existent ID', () => {
      const retrieved = db.getTimeEntry(99999);
      expect(retrieved).toBeNull();
    });
  });

  describe('stopTimeEntry', () => {
    it('should update end time for an active entry', () => {
      const entry = db.createTimeEntry('Test Task', Date.now());
      const endTime = Date.now() + 5000;

      const stopped = db.stopTimeEntry(entry.id, endTime);

      expect(stopped).not.toBeNull();
      expect(stopped?.endTime).toBe(endTime);
    });

    it('should not update already stopped entry', () => {
      const entry = db.createTimeEntry('Test Task', Date.now());
      const endTime1 = Date.now() + 5000;
      const endTime2 = Date.now() + 10000;

      db.stopTimeEntry(entry.id, endTime1);
      const secondStop = db.stopTimeEntry(entry.id, endTime2);

      // Second stop should not change the end time
      expect(secondStop?.endTime).toBe(endTime1);
    });
  });

  describe('getActiveTimeEntry', () => {
    it('should return null when no active entries', () => {
      const active = db.getActiveTimeEntry();
      expect(active).toBeNull();
    });

    it('should return the active entry when one exists', () => {
      const entry = db.createTimeEntry('Active Task', Date.now());
      const active = db.getActiveTimeEntry();

      expect(active).not.toBeNull();
      expect(active?.id).toBe(entry.id);
      expect(active?.endTime).toBeNull();
    });

    it('should return null after stopping the active entry', () => {
      const entry = db.createTimeEntry('Active Task', Date.now());
      db.stopTimeEntry(entry.id, Date.now());

      const active = db.getActiveTimeEntry();
      expect(active).toBeNull();
    });

    it('should return most recent active entry when multiple exist', () => {
      const entry1 = db.createTimeEntry('Task 1', Date.now() - 1000);
      const entry2 = db.createTimeEntry('Task 2', Date.now());

      const active = db.getActiveTimeEntry();
      expect(active?.id).toBe(entry2.id);
    });
  });

  describe('getAllTimeEntries', () => {
    it('should return empty array when no entries', () => {
      const entries = db.getAllTimeEntries();
      expect(entries).toEqual([]);
    });

    it('should return all entries in descending order by start time', () => {
      const entry1 = db.createTimeEntry('Task 1', Date.now() - 2000);
      const entry2 = db.createTimeEntry('Task 2', Date.now() - 1000);
      const entry3 = db.createTimeEntry('Task 3', Date.now());

      const entries = db.getAllTimeEntries();

      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBe(entry3.id);
      expect(entries[1].id).toBe(entry2.id);
      expect(entries[2].id).toBe(entry1.id);
    });

    it('should respect limit parameter', () => {
      db.createTimeEntry('Task 1', Date.now());
      db.createTimeEntry('Task 2', Date.now());
      db.createTimeEntry('Task 3', Date.now());

      const entries = db.getAllTimeEntries(2);
      expect(entries).toHaveLength(2);
    });

    it('should respect offset parameter', () => {
      const entry1 = db.createTimeEntry('Task 1', Date.now() - 2000);
      const entry2 = db.createTimeEntry('Task 2', Date.now() - 1000);
      const entry3 = db.createTimeEntry('Task 3', Date.now());

      const entries = db.getAllTimeEntries(10, 1);

      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe(entry2.id);
      expect(entries[1].id).toBe(entry1.id);
    });
  });

  describe('updateTimeEntry', () => {
    it('should update task name', () => {
      const entry = db.createTimeEntry('Original Task', Date.now());
      const updated = db.updateTimeEntry(entry.id, { taskName: 'Updated Task' });

      expect(updated?.taskName).toBe('Updated Task');
    });

    it('should update start time', () => {
      const originalStart = Date.now() - 5000;
      const newStart = Date.now() - 3000;
      const entry = db.createTimeEntry('Task', originalStart);

      const updated = db.updateTimeEntry(entry.id, { startTime: newStart });
      expect(updated?.startTime).toBe(newStart);
    });

    it('should update end time', () => {
      const entry = db.createTimeEntry('Task', Date.now());
      const endTime = Date.now() + 5000;

      const updated = db.updateTimeEntry(entry.id, { endTime });
      expect(updated?.endTime).toBe(endTime);
    });

    it('should update logged status', () => {
      const entry = db.createTimeEntry('Task', Date.now());
      expect(entry.logged).toBe(false);

      const updated = db.updateTimeEntry(entry.id, { logged: true });
      expect(updated?.logged).toBe(true);
    });

    it('should update multiple fields at once', () => {
      const entry = db.createTimeEntry('Original', Date.now());
      const newStart = Date.now() + 1000;
      const endTime = Date.now() + 5000;

      const updated = db.updateTimeEntry(entry.id, {
        taskName: 'Updated',
        startTime: newStart,
        endTime: endTime,
      });

      expect(updated?.taskName).toBe('Updated');
      expect(updated?.startTime).toBe(newStart);
      expect(updated?.endTime).toBe(endTime);
    });

    it('should update updatedAt timestamp', async () => {
      const entry = db.createTimeEntry('Task', Date.now());
      const originalUpdatedAt = entry.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = db.updateTimeEntry(entry.id, { taskName: 'Updated' });
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should return null for non-existent entry', () => {
      const updated = db.updateTimeEntry(99999, { taskName: 'Updated' });
      expect(updated).toBeNull();
    });
  });

  describe('deleteTimeEntry', () => {
    it('should delete an existing entry', () => {
      const entry = db.createTimeEntry('Task to Delete', Date.now());
      const deleted = db.deleteTimeEntry(entry.id);

      expect(deleted).toBe(true);
      expect(db.getTimeEntry(entry.id)).toBeNull();
    });

    it('should return false for non-existent entry', () => {
      const deleted = db.deleteTimeEntry(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('getTimeEntriesInRange', () => {
    it('should return entries within specified range', () => {
      const now = Date.now();
      const entry1 = db.createTimeEntry('Task 1', now - 10000); // 10s ago
      const entry2 = db.createTimeEntry('Task 2', now - 5000);  // 5s ago
      const entry3 = db.createTimeEntry('Task 3', now);         // now

      const entries = db.getTimeEntriesInRange(now - 6000, now + 1000);

      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.id === entry2.id)).toBe(true);
      expect(entries.some(e => e.id === entry3.id)).toBe(true);
      expect(entries.some(e => e.id === entry1.id)).toBe(false);
    });

    it('should return empty array when no entries in range', () => {
      const now = Date.now();
      db.createTimeEntry('Task', now - 10000);

      const entries = db.getTimeEntriesInRange(now, now + 5000);
      expect(entries).toEqual([]);
    });

    it('should return entries in descending order', () => {
      const now = Date.now();
      const entry1 = db.createTimeEntry('Task 1', now - 5000);
      const entry2 = db.createTimeEntry('Task 2', now - 3000);
      const entry3 = db.createTimeEntry('Task 3', now - 1000);

      const entries = db.getTimeEntriesInRange(now - 6000, now);

      expect(entries[0].id).toBe(entry3.id);
      expect(entries[1].id).toBe(entry2.id);
      expect(entries[2].id).toBe(entry1.id);
    });
  });

  describe('close and persistence', () => {
    it('should close database connection', () => {
      db.close();
      const info = db.getInfo();
      expect(info.isOpen).toBe(false);
    });

    it('should export database', () => {
      db.createTimeEntry('Test Task', Date.now());
      const exported = db.export();
      expect(exported).toBeInstanceOf(Uint8Array);
      expect(exported.length).toBeGreaterThan(0);
    });
  });
});
