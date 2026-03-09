import type {
	ApplyChangesPayload,
	BackupCleanupPreview,
	BackupCleanupResult,
	BackupEntry,
	ChroniiConfig,
	ChroniiConfigUpdate,
	DatabaseInfo,
	ImportOptions,
	PreviewResult,
	RestoreMode,
	TimeEntry,
	TimeEntryUpdate,
} from '../shared/api-types';

export type { TimeEntry } from '../shared/api-types';

interface TimerAPI {
	startTimer: (taskName: string) => Promise<TimeEntry>;
	stopTimer: (id: number) => Promise<TimeEntry | null>;
	getActiveTimer: () => Promise<TimeEntry | null>;
}

interface EntriesAPI {
	getAllEntries: (limit?: number, offset?: number) => Promise<TimeEntry[]>;
	getEntryById: (id: number) => Promise<TimeEntry | null>;
	updateEntry: (
		id: number,
		updates: TimeEntryUpdate,
	) => Promise<TimeEntry | null>;
	deleteEntry: (id: number) => Promise<boolean>;
	getEntriesInRange: (
		startDate: number,
		endDate: number,
	) => Promise<TimeEntry[]>;
}

interface DatabaseAPI {
	getInfo: () => Promise<DatabaseInfo>;
	exportDatabase: (destinationPath?: string) => Promise<boolean>;
	importDatabase: (sourcePathOrBuffer: string | Uint8Array) => Promise<boolean>;
	exportCsv: (destinationPath?: string) => Promise<boolean>;
	importCsv: (
		sourcePathOrCsv: string | Uint8Array,
		options?: ImportOptions,
	) => Promise<boolean>;
	previewImportCsv: (
		sourcePathOrCsv: string | Uint8Array,
		options?: ImportOptions,
	) => Promise<PreviewResult>;
	previewRestoreDb: (
		buffer: Uint8Array,
		mode: RestoreMode,
	) => Promise<PreviewResult>;
	restoreDbWithOptions: (
		buffer: Uint8Array,
		mode: RestoreMode,
	) => Promise<boolean>;
	applyChanges: (changes: ApplyChangesPayload) => Promise<boolean>;
	clearAllData: () => Promise<boolean>;
	selectExportPath: (suggestedName?: string) => Promise<string | null>;
	selectImportPath: () => Promise<string | null>;
	selectCsvExportPath: (suggestedName?: string) => Promise<string | null>;
	selectCsvImportPath: () => Promise<string | null>;
}

interface ConfigAPI {
	getConfig: () => Promise<ChroniiConfig>;
	setConfig: (config: ChroniiConfig) => Promise<ChroniiConfig>;
	updateConfig: (updates: ChroniiConfigUpdate) => Promise<ChroniiConfig>;
}

interface BackupAPI {
	createBackup: () => Promise<BackupEntry | null>;
	listBackups: () => Promise<BackupEntry[]>;
	restoreBackup: (backupPath: string) => Promise<boolean>;
	restoreBackupWithOptions: (
		backupPath: string,
		mode: RestoreMode,
	) => Promise<boolean>;
	previewRestore: (
		backupPath: string,
		mode: RestoreMode,
	) => Promise<PreviewResult>;
	cleanupBackups: () => Promise<BackupCleanupResult>;
	previewCleanup: () => Promise<BackupCleanupPreview>;
	selectBackupLocation: () => Promise<string | null>;
	selectRestoreFile: () => Promise<string | null>;
}

interface ShellAPI {
	openPath: (targetPath: string) => Promise<boolean>;
}

interface WindowAPI {
	minimize: () => Promise<void>;
	maximize: () => Promise<void>;
	close: () => Promise<void>;
	isMaximized: () => Promise<boolean>;
}

interface ViewAPI {
	reload: () => Promise<void>;
	forceReload: () => Promise<void>;
	openDevTools: () => Promise<void>;
	zoomIn: () => Promise<void>;
	zoomOut: () => Promise<void>;
	zoomReset: () => Promise<void>;
}

type IpcListener = (event: unknown, ...args: unknown[]) => void;

interface ElectronAPI {
	on: (channel: string, listener: IpcListener) => void;
	off: (channel: string, listener?: (...args: unknown[]) => void) => void;
	send: (channel: string, ...args: unknown[]) => void;
	invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

declare global {
	interface Window {
		initSqlJs?: typeof import('sql.js');
		ipcRenderer: ElectronAPI;
		timerAPI: TimerAPI;
		entriesAPI: EntriesAPI;
		databaseAPI: DatabaseAPI;
		configAPI: ConfigAPI;
		backupAPI: BackupAPI;
		shellAPI: ShellAPI;
		windowAPI: WindowAPI;
		viewAPI: ViewAPI;
	}
}
