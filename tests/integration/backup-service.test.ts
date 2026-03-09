import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importDatabase, restoreBackup } from '../../electron/backup-service';
import { closeDatabase, getDatabase } from '../../electron/database-factory';

const mockState = vi.hoisted(() => ({
	userDataDir: '',
}));

vi.mock('electron', () => ({
	app: {
		getPath: (name: string) => {
			if (name === 'userData') {
				return mockState.userDataDir;
			}
			return os.tmpdir();
		},
		getVersion: () => '0.0.3-test',
	},
}));

function readTaskNames(dbPath: string): string[] {
	const db = new Database(dbPath, { readonly: true });
	try {
		return db
			.prepare(
				'SELECT task_name FROM time_entries ORDER BY created_at ASC, start_time ASC',
			)
			.all()
			.map((row) => String((row as { task_name: string }).task_name));
	} finally {
		db.close();
	}
}

async function seedDatabase(
	userDataDir: string,
	taskNames: string[],
): Promise<string> {
	mockState.userDataDir = userDataDir;
	closeDatabase();
	const db = await getDatabase();
	for (const [index, taskName] of taskNames.entries()) {
		db.createTimeEntry(taskName, 1700000000000 + index * 1000);
	}
	const dbPath = db.getInfo().path;
	closeDatabase();
	return dbPath;
}

describe('backup-service restore safety', () => {
	let rootDir: string;
	let currentUserDataDir: string;
	let sourceUserDataDir: string;

	beforeEach(() => {
		rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronii-backup-service-'));
		currentUserDataDir = path.join(rootDir, 'current-userdata');
		sourceUserDataDir = path.join(rootDir, 'source-userdata');
		fs.mkdirSync(currentUserDataDir, { recursive: true });
		fs.mkdirSync(sourceUserDataDir, { recursive: true });
	});

	afterEach(() => {
		closeDatabase();
		fs.rmSync(rootDir, { recursive: true, force: true });
	});

	it('atomically swaps in validated imports and keeps a rollback backup', async () => {
		const currentDbPath = await seedDatabase(currentUserDataDir, [
			'Current Task',
		]);
		const sourceDbPath = await seedDatabase(sourceUserDataDir, [
			'Imported Task',
		]);

		mockState.userDataDir = currentUserDataDir;
		await importDatabase(sourceDbPath);
		closeDatabase();

		expect(readTaskNames(currentDbPath)).toEqual(['Imported Task']);

		const backupDir = path.join(currentUserDataDir, 'backups');
		const backups = fs
			.readdirSync(backupDir)
			.filter((name) => name.endsWith('.db.bak'));
		expect(backups).toHaveLength(1);
		expect(readTaskNames(path.join(backupDir, backups[0]))).toEqual([
			'Current Task',
		]);
	});

	it('preserves the live database when incoming data fails validation', async () => {
		const currentDbPath = await seedDatabase(currentUserDataDir, [
			'Current Task',
		]);
		const invalidPath = path.join(sourceUserDataDir, 'invalid.db');
		fs.writeFileSync(invalidPath, 'not-a-sqlite-db', 'utf-8');

		mockState.userDataDir = currentUserDataDir;
		await expect(importDatabase(invalidPath)).rejects.toThrow();
		closeDatabase();

		expect(readTaskNames(currentDbPath)).toEqual(['Current Task']);
		expect(fs.existsSync(path.join(currentUserDataDir, 'backups'))).toBe(false);
	});

	it('uses the same safety wrapper for backup restore', async () => {
		const currentDbPath = await seedDatabase(currentUserDataDir, [
			'Current Task',
		]);
		const sourceDbPath = await seedDatabase(sourceUserDataDir, ['Backup Task']);
		const backupPath = path.join(sourceUserDataDir, 'restore.db.bak');
		fs.copyFileSync(sourceDbPath, backupPath);

		mockState.userDataDir = currentUserDataDir;
		await restoreBackup(backupPath);
		closeDatabase();

		expect(readTaskNames(currentDbPath)).toEqual(['Backup Task']);
		const backups = fs
			.readdirSync(path.join(currentUserDataDir, 'backups'))
			.filter((name) => name.endsWith('.db.bak'));
		expect(backups).toHaveLength(1);
	});
});
