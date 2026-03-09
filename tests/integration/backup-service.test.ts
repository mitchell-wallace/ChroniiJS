import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
	userDataDir: '',
	dbPath: '',
	closeDatabase: vi.fn(),
	updateConfig: vi.fn(),
}));

vi.mock('electron', () => ({
	app: {
		getPath: () => mockState.userDataDir,
		getVersion: () => '0.0.3-test',
	},
}));

vi.mock('../../electron/config-store', () => ({
	getConfig: () => ({
		backup: {
			enabled: true,
			format: 'db',
			location: null,
			weeklyRetention: 6,
			lastWeeklyBackup: null,
			lastVersion: null,
			versionRetention: 2,
			reminders: {
				enabled: false,
				dayOfWeek: 5,
				format: 'db',
				lastDismissed: null,
			},
		},
	}),
	getDefaultBackupDirectory: () => path.join(mockState.userDataDir, 'backups'),
	updateConfig: mockState.updateConfig,
}));

vi.mock('../../electron/database-factory', () => ({
	getDatabase: async () => ({
		getInfo: () => ({
			path: mockState.dbPath,
			isOpen: true,
			environment: 'test',
		}),
		backupTo: async (destinationPath: string) => {
			fs.copyFileSync(mockState.dbPath, destinationPath);
		},
		getAllTimeEntriesForExport: () => [],
	}),
	closeDatabase: mockState.closeDatabase,
}));

vi.mock('better-sqlite3', () => ({
	default: class MockDatabase {
		constructor(filePath: string) {
			const content = fs.readFileSync(filePath, 'utf-8');
			if (content.startsWith('invalid')) {
				throw new Error('invalid sqlite file');
			}
		}

		prepare(sql: string) {
			if (sql.includes('PRAGMA table_info')) {
				return {
					all: () => [{ name: 'logged' }],
				};
			}

			return {
				all: () => [],
			};
		}

		close() {}
	},
}));

const { importDatabase, restoreBackup } = await import(
	'../../electron/backup-service'
);

describe('backup-service restore safety', () => {
	beforeEach(() => {
		mockState.closeDatabase.mockReset();
		mockState.updateConfig.mockReset();
		mockState.userDataDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'chronii-backup-service-'),
		);
		mockState.dbPath = path.join(mockState.userDataDir, 'chronii.db');
		fs.writeFileSync(mockState.dbPath, 'current-db', 'utf-8');
	});

	afterEach(() => {
		if (mockState.userDataDir) {
			fs.rmSync(mockState.userDataDir, { recursive: true, force: true });
		}
	});

	it('atomically swaps in validated imports and keeps a rollback backup', async () => {
		const sourcePath = path.join(mockState.userDataDir, 'incoming.db');
		fs.writeFileSync(sourcePath, 'valid-db', 'utf-8');

		await importDatabase(sourcePath);

		expect(fs.readFileSync(mockState.dbPath, 'utf-8')).toBe('valid-db');
		expect(mockState.closeDatabase).toHaveBeenCalledTimes(1);

		const backupDir = path.join(mockState.userDataDir, 'backups');
		const backups = fs
			.readdirSync(backupDir)
			.filter((name) => name.endsWith('.db.bak'));
		expect(backups).toHaveLength(1);
		expect(fs.readFileSync(path.join(backupDir, backups[0]), 'utf-8')).toBe(
			'current-db',
		);
	});

	it('preserves the live database when incoming data fails validation', async () => {
		const sourcePath = path.join(mockState.userDataDir, 'incoming-invalid.db');
		fs.writeFileSync(sourcePath, 'invalid-db', 'utf-8');

		await expect(importDatabase(sourcePath)).rejects.toThrow(
			'invalid sqlite file',
		);

		expect(fs.readFileSync(mockState.dbPath, 'utf-8')).toBe('current-db');
		expect(mockState.closeDatabase).not.toHaveBeenCalled();
		expect(fs.existsSync(path.join(mockState.userDataDir, 'backups'))).toBe(
			false,
		);
	});

	it('uses the same safety wrapper for backup restore', async () => {
		const backupPath = path.join(mockState.userDataDir, 'restore.db.bak');
		fs.writeFileSync(backupPath, 'restored-db', 'utf-8');

		await restoreBackup(backupPath);

		expect(fs.readFileSync(mockState.dbPath, 'utf-8')).toBe('restored-db');
		const backups = fs
			.readdirSync(path.join(mockState.userDataDir, 'backups'))
			.filter((name) => name.endsWith('.db.bak'));
		expect(backups).toHaveLength(1);
	});
});
