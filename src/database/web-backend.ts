import type {
	InitSqlJsStatic,
	Database as SqlJsDatabase,
	SqlJsStatic,
	SqlValue,
} from 'sql.js';

import type {
	ApplyChangesPayload,
	BackupCleanupPreview,
	ChroniiConfig,
	ChroniiConfigUpdate,
	DatabaseInfo,
	ImportOptions,
	PreviewEntrySnapshot,
	PreviewItem,
	PreviewResult,
	RestoreMode,
	TimeEntry,
	TimeEntryUpdate,
} from '../shared/api-types';
import { SqlJsDatabaseService } from './database-sqljs';

// Singleton database instance
let dbInstance: SqlJsDatabaseService | null = null;
let initPromise: Promise<SqlJsDatabaseService> | null = null;

async function getDatabase(): Promise<SqlJsDatabaseService> {
	if (!dbInstance) {
		if (!initPromise) {
			initPromise = initializeDatabase();
		}
		dbInstance = await initPromise;
	}
	return dbInstance;
}

async function initializeDatabase(): Promise<SqlJsDatabaseService> {
	const db = new SqlJsDatabaseService();
	// Ensure the underlying sql.js Database is fully initialized
	await db.waitUntilReady();
	return db;
}

const DEFAULT_CONFIG: ChroniiConfig = {
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
};

function getStoredConfig(): ChroniiConfig {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG };
	try {
		const raw = localStorage.getItem('chronii-config');
		if (!raw) return { ...DEFAULT_CONFIG };
		const parsed = JSON.parse(raw) as Partial<ChroniiConfig>;
		return {
			...DEFAULT_CONFIG,
			...parsed,
			backup: {
				...DEFAULT_CONFIG.backup,
				...(parsed.backup ?? {}),
			},
		};
	} catch (error) {
		console.warn('Failed to read web config, using defaults:', error);
		return { ...DEFAULT_CONFIG };
	}
}

function saveStoredConfig(config: ChroniiConfig): ChroniiConfig {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('chronii-config', JSON.stringify(config));
	}
	return config;
}

function updateStoredConfig(updates: ChroniiConfigUpdate): ChroniiConfig {
	const current = getStoredConfig();
	const merged: ChroniiConfig = {
		...current,
		backup: {
			...current.backup,
			...(updates.backup ?? {}),
		},
	};
	return saveStoredConfig(merged);
}

function downloadDatabase(data: Uint8Array, filename: string) {
	const blob = new Blob([data as BlobPart], { type: 'application/x-sqlite3' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string): string {
	if (value.includes('"')) {
		value = value.replace(/"/g, '""');
	}
	if (
		value.includes(',') ||
		value.includes('\n') ||
		value.includes('\r') ||
		value.includes('"')
	) {
		return `"${value}"`;
	}
	return value;
}

function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (value: number) => value.toString().padStart(2, '0');
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseDateTime(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^\d+$/.test(trimmed)) {
		const numeric = Number(trimmed);
		return Number.isFinite(numeric) ? numeric : null;
	}

	const match = trimmed.match(
		/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
	);
	if (match) {
		const [, year, month, day, hour, minute, second] = match;
		return new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
		).getTime();
	}

	const parsed = Date.parse(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function entriesToCsv(entries: TimeEntry[]): string {
	const header = [
		'id',
		'taskName',
		'startTime',
		'endTime',
		'createdAt',
		'updatedAt',
		'logged',
	];
	const rows = entries.map((entry) => [
		entry.id?.toString() ?? '',
		escapeCsvValue(entry.taskName),
		formatDateTime(entry.startTime),
		entry.endTime === null ? '' : formatDateTime(entry.endTime),
		formatDateTime(entry.createdAt),
		formatDateTime(entry.updatedAt),
		entry.logged ? '1' : '0',
	]);
	return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function parseCsvRows(csvText: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < csvText.length; i += 1) {
		const char = csvText[i];

		if (inQuotes) {
			if (char === '"') {
				if (csvText[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
			continue;
		}

		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}

		if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}

		if (char === '\r') {
			if (csvText[i + 1] === '\n') {
				continue;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}

		field += char;
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

function parseCsvEntries(csvText: string): Array<{
	id?: number;
	taskName: string;
	startTime: number;
	endTime: number | null;
	createdAt?: number;
	updatedAt?: number;
	logged?: boolean;
}> {
	const rows = parseCsvRows(csvText).filter((row) =>
		row.some((value) => value.trim() !== ''),
	);
	if (rows.length === 0) return [];

	const header = rows[0].map((value) => value.trim());
	const indexOf = (name: string) =>
		header.findIndex((value) => value.toLowerCase() === name.toLowerCase());

	const idIndex = indexOf('id');
	const taskIndex = indexOf('taskName');
	const startIndex = indexOf('startTime');
	const endIndex = indexOf('endTime');
	const createdIndex = indexOf('createdAt');
	const updatedIndex = indexOf('updatedAt');
	const loggedIndex = indexOf('logged');

	if (taskIndex === -1 || startIndex === -1) {
		throw new Error('CSV is missing required columns.');
	}

	return rows.slice(1).map((row) => {
		const taskName = row[taskIndex] ?? '';
		const idValue = idIndex >= 0 ? row[idIndex] : '';
		const idNumeric =
			idValue && /^\d+$/.test(idValue.trim()) ? Number(idValue) : null;
		const startTime = parseDateTime(row[startIndex] ?? '');
		const endValue = row[endIndex] ?? '';
		const endTime = endValue === '' ? null : parseDateTime(endValue);
		const createdValue = createdIndex >= 0 ? row[createdIndex] : '';
		const updatedValue = updatedIndex >= 0 ? row[updatedIndex] : '';
		const loggedValue = loggedIndex >= 0 ? row[loggedIndex] : '';
		const logged =
			loggedValue === '1' ||
			loggedValue.toLowerCase() === 'true' ||
			loggedValue.toLowerCase() === 'yes';

		if (startTime === null || !Number.isFinite(startTime)) {
			throw new Error('CSV contains invalid start times.');
		}

		const parsedCreated = createdValue ? parseDateTime(createdValue) : null;
		const createdAt = parsedCreated !== null ? parsedCreated : startTime;
		const parsedUpdated = updatedValue ? parseDateTime(updatedValue) : null;
		const updatedAt = parsedUpdated !== null ? parsedUpdated : createdAt;

		return {
			id: Number.isFinite(idNumeric) ? Number(idNumeric) : undefined,
			taskName,
			startTime,
			endTime: endTime !== null && Number.isFinite(endTime) ? endTime : null,
			createdAt,
			updatedAt,
			logged,
		};
	});
}

function downloadCsv(csvText: string, filename: string) {
	const blob = new Blob([csvText], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function normalizeTime(value: number | null): number | null {
	if (value === null) return null;
	return Math.floor(value / 1000);
}

function getEntryKey(entry: {
	taskName: string;
	startTime: number;
	endTime: number | null;
	createdAt: number;
	updatedAt: number;
	logged: boolean;
}): string {
	return JSON.stringify([
		entry.taskName,
		normalizeTime(entry.startTime),
		normalizeTime(entry.endTime),
		normalizeTime(entry.createdAt),
		normalizeTime(entry.updatedAt),
		entry.logged ? 1 : 0,
	]);
}

function getEntryIdentity(entry: EntrySnapshot): string {
	return entry.id !== undefined
		? `id:${entry.id}`
		: `key:${getEntryKey(entry)}`;
}

function buildEntryIdentityMap(
	entries: EntrySnapshot[],
): Map<string, EntrySnapshot> {
	const map = new Map<string, EntrySnapshot>();
	for (const entry of entries) {
		map.set(getEntryIdentity(entry), entry);
	}
	return map;
}

function buildEntryMatchMap(
	entries: PreviewEntrySnapshot[],
): Map<string, PreviewEntrySnapshot> {
	const map = new Map<string, PreviewEntrySnapshot>();
	for (const entry of entries) {
		if (entry.id !== undefined) {
			map.set(`id:${entry.id}`, entry);
		}
		map.set(`key:${getEntryKey(entry)}`, entry);
	}
	return map;
}

type EntrySnapshot = PreviewEntrySnapshot;
type QueryRow = SqlValue[];

function mapRowToEntrySnapshot(row: QueryRow): EntrySnapshot {
	return {
		id: Number(row[0]),
		taskName: String(row[1] ?? ''),
		startTime: Number(row[2]),
		endTime: row[3] === null ? null : Number(row[3]),
		createdAt: Number(row[4]),
		updatedAt: Number(row[5]),
		logged: Boolean(row[6]),
	};
}

async function readEntriesFromDbBuffer(
	buffer: Uint8Array,
): Promise<EntrySnapshot[]> {
	const globalInit = window.initSqlJs as InitSqlJsStatic | undefined;
	if (typeof globalInit !== 'function') {
		throw new Error(
			'window.initSqlJs is not a function. Ensure sql-wasm is loaded.',
		);
	}
	const SQL = (await globalInit({
		locateFile: (_file: string) => `/sql-wasm.wasm`,
	})) as SqlJsStatic;
	const tempDb = new SQL.Database(buffer) as SqlJsDatabase;
	try {
		const columns =
			tempDb.exec('PRAGMA table_info(time_entries)')[0]?.values ?? [];
		const hasLogged = columns.some((row) => row[1] === 'logged');
		const selectSql = hasLogged
			? `SELECT id, task_name as taskName, start_time as startTime, end_time as endTime,
            created_at as createdAt, updated_at as updatedAt, logged
         FROM time_entries
         ORDER BY start_time DESC`
			: `SELECT id, task_name as taskName, start_time as startTime, end_time as endTime,
            created_at as createdAt, updated_at as updatedAt, 0 as logged
         FROM time_entries
         ORDER BY start_time DESC`;
		const result = tempDb.exec(selectSql);
		if (result.length === 0) return [];
		return result[0].values.map((row) => mapRowToEntrySnapshot(row));
	} finally {
		tempDb.close();
	}
}

function buildRestorePreview(
	backupEntries: EntrySnapshot[],
	currentEntries: EntrySnapshot[],
	mode: RestoreMode,
): PreviewResult {
	const backupMap = buildEntryIdentityMap(backupEntries);
	const currentMap = buildEntryIdentityMap(currentEntries);
	const items: PreviewItem[] = [];
	let adds = 0;
	let removes = 0;
	let rollbacks = 0;
	let skips = 0;
	let cutoffTime: number | undefined;

	if (mode === 'replace') {
		currentEntries.forEach((entry) => {
			const match = backupMap.get(getEntryIdentity(entry));
			if (match) {
				items.push({
					action: 'rollback',
					entry: match,
					source: 'backup',
					incomingEntry: match,
					currentEntry: entry,
				});
				rollbacks += 1;
			} else {
				items.push({
					action: 'remove',
					entry,
					source: 'current',
					currentEntry: entry,
				});
				removes += 1;
			}
		});
		backupEntries.forEach((entry) => {
			if (!currentMap.has(getEntryIdentity(entry))) {
				items.push({
					action: 'add',
					entry,
					source: 'backup',
					incomingEntry: entry,
				});
				adds += 1;
			}
		});
	}

	if (mode === 'dedupe') {
		backupEntries.forEach((entry) => {
			const existing = currentMap.get(getEntryIdentity(entry));
			if (existing) {
				items.push({
					action: 'skip',
					entry,
					source: 'backup',
					incomingEntry: entry,
					currentEntry: existing,
				});
				skips += 1;
			} else {
				items.push({
					action: 'add',
					entry,
					source: 'backup',
					incomingEntry: entry,
				});
				adds += 1;
			}
		});
	}

	if (mode === 'merge') {
		backupEntries.forEach((entry) => {
			const existing = currentMap.get(getEntryIdentity(entry));
			if (existing) {
				items.push({
					action: 'rollback',
					entry,
					source: 'backup',
					incomingEntry: entry,
					currentEntry: existing,
				});
				rollbacks += 1;
			} else {
				items.push({
					action: 'add',
					entry,
					source: 'backup',
					incomingEntry: entry,
				});
				adds += 1;
			}
		});
	}

	if (mode === 'keep-newer') {
		cutoffTime = backupEntries
			.map((entry) => entry.endTime ?? null)
			.filter((value): value is number => value !== null)
			.reduce((max, value) => Math.max(max, value), 0);

		const effectiveCutoffTime = cutoffTime;

		currentEntries.forEach((entry) => {
			const match = backupMap.get(getEntryIdentity(entry));
			if (match) {
				items.push({
					action: 'rollback',
					entry: match,
					source: 'backup',
					incomingEntry: match,
					currentEntry: entry,
				});
				rollbacks += 1;
				return;
			}
			const isNewer =
				entry.endTime !== null
					? entry.endTime > effectiveCutoffTime
					: entry.startTime > effectiveCutoffTime;
			if (!isNewer) {
				items.push({
					action: 'remove',
					entry,
					source: 'current',
					currentEntry: entry,
				});
				removes += 1;
			}
		});

		backupEntries.forEach((entry) => {
			if (!currentMap.has(getEntryIdentity(entry))) {
				items.push({
					action: 'add',
					entry,
					source: 'backup',
					incomingEntry: entry,
				});
				adds += 1;
			}
		});
	}

	return {
		summary: {
			adds,
			removes,
			rollbacks,
			skips,
			total: items.length,
		},
		items,
		cutoffTime,
		mode,
	};
}

// Web backend API that mimics the Electron IPC API
export const webBackend = {
	timerAPI: {
		startTimer: async (taskName: string): Promise<TimeEntry> => {
			const db = await getDatabase();
			// Stop any active timer first
			const activeEntry = db.getActiveTimeEntry();
			if (activeEntry) {
				db.stopTimeEntry(activeEntry.id, Date.now());
			}
			// Start new timer
			return db.createTimeEntry(taskName, Date.now());
		},

		stopTimer: async (id: number): Promise<TimeEntry | null> => {
			const db = await getDatabase();
			return db.stopTimeEntry(id, Date.now());
		},

		getActiveTimer: async (): Promise<TimeEntry | null> => {
			const db = await getDatabase();
			return db.getActiveTimeEntry();
		},
	},

	entriesAPI: {
		getAllEntries: async (
			limit?: number,
			offset?: number,
		): Promise<TimeEntry[]> => {
			const db = await getDatabase();
			return db.getAllTimeEntries(limit, offset);
		},

		getEntryById: async (id: number): Promise<TimeEntry | null> => {
			const db = await getDatabase();
			return db.getTimeEntry(id);
		},

		updateEntry: async (
			id: number,
			updates: TimeEntryUpdate,
		): Promise<TimeEntry | null> => {
			const db = await getDatabase();
			return db.updateTimeEntry(id, updates);
		},

		deleteEntry: async (id: number): Promise<boolean> => {
			const db = await getDatabase();
			return db.deleteTimeEntry(id);
		},

		getEntriesInRange: async (
			startDate: number,
			endDate: number,
		): Promise<TimeEntry[]> => {
			const db = await getDatabase();
			return db.getTimeEntriesInRange(startDate, endDate);
		},
	},

	databaseAPI: {
		getInfo: async (): Promise<DatabaseInfo> => {
			const db = await getDatabase();
			return db.getInfo();
		},
		exportDatabase: async (): Promise<boolean> => {
			const db = await getDatabase();
			const data = db.export();
			downloadDatabase(data, `chronii-database-${Date.now()}.db`);
			return true;
		},
		exportCsv: async (): Promise<boolean> => {
			const db = await getDatabase();
			const entries = db.getAllTimeEntriesForExport();
			const csvText = entriesToCsv(entries);
			downloadCsv(csvText, `chronii-entries-${Date.now()}.csv`);
			return true;
		},
		importDatabase: async (data: Uint8Array): Promise<boolean> => {
			const db = await getDatabase();
			(db as SqlJsDatabaseService).importFromBuffer(data);
			return true;
		},
		importCsv: async (
			csvText: string | Uint8Array,
			options?: ImportOptions,
		): Promise<boolean> => {
			const db = await getDatabase();
			const csvString =
				typeof csvText === 'string'
					? csvText
					: new TextDecoder().decode(csvText);
			const entries = parseCsvEntries(csvString);
			const dedupe = options?.dedupe ?? true;
			if (dedupe) {
				const currentEntries = db.getAllTimeEntriesForExport();
				const currentMap = buildEntryMatchMap(currentEntries);
				const filtered = entries.filter((entry) => {
					const identity =
						entry.id !== undefined
							? `id:${entry.id}`
							: `key:${getEntryKey({
									taskName: entry.taskName,
									startTime: entry.startTime,
									endTime: entry.endTime,
									createdAt: entry.createdAt ?? entry.startTime,
									updatedAt: entry.updatedAt ?? entry.startTime,
									logged: entry.logged ?? false,
								})}`;
					return !currentMap.has(identity);
				});
				db.importTimeEntries(filtered);
			} else {
				db.importTimeEntries(entries);
			}
			return true;
		},
		previewImportCsv: async (
			csvText: string | Uint8Array,
			options?: ImportOptions,
		): Promise<PreviewResult> => {
			const db = await getDatabase();
			const csvString =
				typeof csvText === 'string'
					? csvText
					: new TextDecoder().decode(csvText);
			const incoming = parseCsvEntries(csvString);
			const current = db.getAllTimeEntriesForExport();
			const dedupe = options?.dedupe ?? true;
			const currentMap = buildEntryMatchMap(current);
			const items = incoming.map((entry) => {
				const key =
					entry.id !== undefined
						? `id:${entry.id}`
						: `key:${getEntryKey({
								taskName: entry.taskName,
								startTime: entry.startTime,
								endTime: entry.endTime,
								createdAt: entry.createdAt ?? entry.startTime,
								updatedAt: entry.updatedAt ?? entry.startTime,
								logged: entry.logged ?? false,
							})}`;
				const existing = currentMap.get(key);
				if (dedupe && existing) {
					return {
						action: 'skip',
						entry,
						source: 'import',
						incomingEntry: entry,
						currentEntry: existing,
					};
				}
				return {
					action: 'add',
					entry,
					source: 'import',
					incomingEntry: entry,
				};
			});

			const adds = items.filter((item) => item.action === 'add').length;
			const skips = items.filter((item) => item.action === 'skip').length;

			return {
				summary: {
					adds,
					removes: 0,
					rollbacks: 0,
					skips,
					total: items.length,
				},
				items,
			};
		},
		previewRestoreDb: async (
			buffer: Uint8Array,
			mode: RestoreMode,
		): Promise<PreviewResult> => {
			const backupEntries = await readEntriesFromDbBuffer(buffer);
			const db = await getDatabase();
			const currentEntries = db.getAllTimeEntriesForExport().map((entry) => ({
				id: entry.id,
				taskName: entry.taskName,
				startTime: entry.startTime,
				endTime: entry.endTime,
				createdAt: entry.createdAt,
				updatedAt: entry.updatedAt,
				logged: entry.logged,
			}));
			return buildRestorePreview(backupEntries, currentEntries, mode);
		},
		restoreDbWithOptions: async (
			buffer: Uint8Array,
			mode: RestoreMode,
		): Promise<boolean> => {
			const db = await getDatabase();
			if (mode === 'replace') {
				(db as SqlJsDatabaseService).importFromBuffer(buffer);
				return true;
			}

			const backupEntries = await readEntriesFromDbBuffer(buffer);
			const currentEntries = db.getAllTimeEntriesForExport().map((entry) => ({
				id: entry.id,
				taskName: entry.taskName,
				startTime: entry.startTime,
				endTime: entry.endTime,
				createdAt: entry.createdAt,
				updatedAt: entry.updatedAt,
				logged: entry.logged,
			}));
			const currentKeys = new Set(
				currentEntries.map((entry) => getEntryIdentity(entry)),
			);

			if (mode === 'dedupe') {
				const toAdd = backupEntries.filter(
					(entry) => !currentKeys.has(getEntryIdentity(entry)),
				);
				db.importTimeEntries(toAdd);
				return true;
			}

			if (mode === 'merge') {
				const currentEntries = db.getAllTimeEntriesForExport().map((entry) => ({
					id: entry.id,
					taskName: entry.taskName,
					startTime: entry.startTime,
					endTime: entry.endTime,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt,
					logged: entry.logged,
				}));
				const currentMap = buildEntryIdentityMap(currentEntries);
				const toAdd = backupEntries.filter(
					(entry) => !currentMap.has(getEntryIdentity(entry)),
				);
				db.importTimeEntries(toAdd);
				return true;
			}

			const cutoffTime = backupEntries
				.map((entry) => entry.endTime ?? null)
				.filter((value): value is number => value !== null)
				.reduce((max, value) => Math.max(max, value), 0);
			const keepEntries = currentEntries.filter((entry) =>
				entry.endTime !== null
					? entry.endTime > cutoffTime
					: entry.startTime > cutoffTime,
			);
			(db as SqlJsDatabaseService).importFromBuffer(buffer);
			const backupKeys = new Set(
				backupEntries.map((entry) => getEntryIdentity(entry)),
			);
			const toAdd = keepEntries.filter(
				(entry) => !backupKeys.has(getEntryIdentity(entry)),
			);
			db.importTimeEntries(toAdd);
			return true;
		},
		clearAllData: async (): Promise<boolean> => {
			const db = await getDatabase();
			db.clearAllEntries();
			return true;
		},
		applyChanges: async (changes: ApplyChangesPayload): Promise<boolean> => {
			const db = await getDatabase();
			const removes = changes?.removes ?? [];
			const adds = changes?.adds ?? [];
			const updates = changes?.updates ?? [];
			if (removes.length > 0) {
				db.deleteEntriesByMatch(removes);
			}
			if (updates.length > 0) {
				db.updateEntriesById(updates);
			}
			if (adds.length > 0) {
				db.importTimeEntries(adds);
			}
			return true;
		},
		selectExportPath: async () => null,
		selectImportPath: async () => null,
		selectCsvExportPath: async () => null,
		selectCsvImportPath: async () => null,
	},

	configAPI: {
		getConfig: async (): Promise<ChroniiConfig> => {
			return getStoredConfig();
		},
		setConfig: async (config: ChroniiConfig): Promise<ChroniiConfig> => {
			return saveStoredConfig(config);
		},
		updateConfig: async (
			updates: ChroniiConfigUpdate,
		): Promise<ChroniiConfig> => {
			return updateStoredConfig(updates);
		},
	},

	backupAPI: {
		createBackup: async (): Promise<null> => {
			const db = await getDatabase();
			const data = db.export();
			downloadDatabase(
				data,
				`${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-chronii-database.db.bak`,
			);
			return null;
		},
		listBackups: async (): Promise<[]> => {
			return [];
		},
		restoreBackup: async (): Promise<boolean> => {
			console.warn('Restore not supported directly in web version');
			return false;
		},
		restoreBackupWithOptions: async (): Promise<boolean> => {
			console.warn('Restore not supported directly in web version');
			return false;
		},
		previewRestore: async (): Promise<null> => {
			console.warn('Restore preview not supported directly in web version');
			return null;
		},
		cleanupBackups: async (): Promise<{
			deleted: number;
			backupDir: string;
		}> => {
			console.warn('Backup cleanup not supported directly in web version');
			return { deleted: 0, backupDir: '' };
		},
		previewCleanup: async (): Promise<BackupCleanupPreview> => {
			console.warn(
				'Backup cleanup preview not supported directly in web version',
			);
			return { backupDir: '', totalFiles: 0, totalBytes: 0, files: [] };
		},
		selectBackupLocation: async (): Promise<string | null> => null,
		selectRestoreFile: async (): Promise<string | null> => null,
	},

	// Note: Window and View APIs are not applicable for web version
	windowAPI: {
		minimize: async () => {
			console.warn('Window minimize not supported in web version');
		},
		maximize: async () => {
			console.warn('Window maximize not supported in web version');
		},
		close: async () => {
			console.warn('Window close not supported in web version');
		},
		isMaximized: async (): Promise<boolean> => {
			return false;
		},
	},

	viewAPI: {
		reload: async () => {
			window.location.reload();
		},
		forceReload: async () => {
			window.location.reload();
		},
		openDevTools: async () => {
			console.warn(
				'Dev tools can be opened via browser: F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows/Linux)',
			);
		},
		zoomIn: async () => {
			console.warn(
				'Browser zoom not supported programmatically. Use Ctrl+Plus or Cmd+Plus',
			);
		},
		zoomOut: async () => {
			console.warn(
				'Browser zoom not supported programmatically. Use Ctrl+Minus or Cmd+Minus',
			);
		},
		zoomReset: async () => {
			console.warn(
				'Browser zoom reset not supported programmatically. Use Ctrl+0 or Cmd+0',
			);
		},
	},
};

export const __test__ = {
	entriesToCsv,
	parseCsvEntries,
	getEntryKey,
	normalizeTime,
};

// Helper to initialize the web backend and inject it into window
export async function initializeWebBackend() {
	// Make sure database is initialized
	await getDatabase();

	// Inject APIs into window object for compatibility with existing components
	// Only if window exists (browser environment)
	if (typeof window !== 'undefined') {
		window.timerAPI = webBackend.timerAPI;
		window.entriesAPI = webBackend.entriesAPI;
		window.databaseAPI = webBackend.databaseAPI;
		window.configAPI = webBackend.configAPI;
		window.backupAPI = webBackend.backupAPI;
		window.windowAPI = webBackend.windowAPI;
		window.viewAPI = webBackend.viewAPI;
	}

	console.log('Web backend initialized');
}

// Helper to reset database instance for tests
export function resetDatabaseForTests() {
	if (dbInstance) {
		dbInstance.close();
	}
	dbInstance = null;
	initPromise = null;
}
