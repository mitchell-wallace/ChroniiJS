import { contextBridge, ipcRenderer } from 'electron';

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
} from '../src/shared/api-types';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
	on(...args: Parameters<typeof ipcRenderer.on>) {
		const [channel, listener] = args;
		return ipcRenderer.on(channel, (event, ...args) =>
			listener(event, ...args),
		);
	},
	off(...args: Parameters<typeof ipcRenderer.off>) {
		const [channel, ...omit] = args;
		return ipcRenderer.off(channel, ...omit);
	},
	send(...args: Parameters<typeof ipcRenderer.send>) {
		const [channel, ...omit] = args;
		return ipcRenderer.send(channel, ...omit);
	},
	invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
		const [channel, ...omit] = args;
		return ipcRenderer.invoke(channel, ...omit);
	},
});

// Expose timer API
contextBridge.exposeInMainWorld('timerAPI', {
	startTimer: (taskName: string): Promise<TimeEntry> =>
		ipcRenderer.invoke('timer:start', taskName),

	stopTimer: (id: number): Promise<TimeEntry | null> =>
		ipcRenderer.invoke('timer:stop', id),

	getActiveTimer: (): Promise<TimeEntry | null> =>
		ipcRenderer.invoke('timer:get-active'),
});

// Expose entries API
contextBridge.exposeInMainWorld('entriesAPI', {
	getAllEntries: (limit?: number, offset?: number): Promise<TimeEntry[]> =>
		ipcRenderer.invoke('entries:get-all', limit, offset),

	getEntryById: (id: number): Promise<TimeEntry | null> =>
		ipcRenderer.invoke('entries:get-by-id', id),

	updateEntry: (
		id: number,
		updates: TimeEntryUpdate,
	): Promise<TimeEntry | null> =>
		ipcRenderer.invoke('entries:update', id, updates),

	deleteEntry: (id: number): Promise<boolean> =>
		ipcRenderer.invoke('entries:delete', id),

	getEntriesInRange: (
		startDate: number,
		endDate: number,
	): Promise<TimeEntry[]> =>
		ipcRenderer.invoke('entries:get-range', startDate, endDate),
});

// Expose database API
contextBridge.exposeInMainWorld('databaseAPI', {
	getInfo: (): Promise<DatabaseInfo> => ipcRenderer.invoke('db:info'),
	exportDatabase: (destinationPath?: string): Promise<boolean> =>
		ipcRenderer.invoke('db:export', destinationPath),
	importDatabase: (sourcePathOrBuffer: string | Uint8Array): Promise<boolean> =>
		ipcRenderer.invoke('db:import', sourcePathOrBuffer),
	exportCsv: (destinationPath?: string): Promise<boolean> =>
		ipcRenderer.invoke('db:export-csv', destinationPath),
	importCsv: (
		sourcePathOrCsv: string | Uint8Array,
		options?: ImportOptions,
	): Promise<boolean> =>
		ipcRenderer.invoke('db:import-csv', sourcePathOrCsv, options),
	previewImportCsv: (
		sourcePathOrCsv: string | Uint8Array,
		options?: ImportOptions,
	): Promise<PreviewResult> =>
		ipcRenderer.invoke('db:preview-import-csv', sourcePathOrCsv, options),
	applyChanges: (changes: ApplyChangesPayload): Promise<boolean> =>
		ipcRenderer.invoke('db:apply-changes', changes),
	clearAllData: (): Promise<boolean> => ipcRenderer.invoke('db:clear-all'),
	selectExportPath: (suggestedName?: string): Promise<string | null> =>
		ipcRenderer.invoke('db:select-export-path', suggestedName),
	selectImportPath: (): Promise<string | null> =>
		ipcRenderer.invoke('db:select-import-path'),
	selectCsvExportPath: (suggestedName?: string): Promise<string | null> =>
		ipcRenderer.invoke('db:select-export-csv-path', suggestedName),
	selectCsvImportPath: (): Promise<string | null> =>
		ipcRenderer.invoke('db:select-import-csv-path'),
});

// Expose config API
contextBridge.exposeInMainWorld('configAPI', {
	getConfig: (): Promise<ChroniiConfig> => ipcRenderer.invoke('config:get'),
	setConfig: (config: ChroniiConfig): Promise<ChroniiConfig> =>
		ipcRenderer.invoke('config:set', config),
	updateConfig: (updates: ChroniiConfigUpdate): Promise<ChroniiConfig> =>
		ipcRenderer.invoke('config:update', updates),
});

// Expose backup API
contextBridge.exposeInMainWorld('backupAPI', {
	createBackup: (): Promise<BackupEntry | null> =>
		ipcRenderer.invoke('backup:create'),
	listBackups: (): Promise<BackupEntry[]> => ipcRenderer.invoke('backup:list'),
	restoreBackup: (backupPath: string): Promise<boolean> =>
		ipcRenderer.invoke('backup:restore', backupPath),
	restoreBackupWithOptions: (
		backupPath: string,
		mode: RestoreMode,
	): Promise<boolean> =>
		ipcRenderer.invoke('backup:restore-with-options', backupPath, mode),
	previewRestore: (
		backupPath: string,
		mode: RestoreMode,
	): Promise<PreviewResult> =>
		ipcRenderer.invoke('backup:preview-restore', backupPath, mode),
	cleanupBackups: (): Promise<BackupCleanupResult> =>
		ipcRenderer.invoke('backup:cleanup'),
	previewCleanup: (): Promise<BackupCleanupPreview> =>
		ipcRenderer.invoke('backup:preview-cleanup'),
	selectBackupLocation: (): Promise<string | null> =>
		ipcRenderer.invoke('backup:select-location'),
	selectRestoreFile: (): Promise<string | null> =>
		ipcRenderer.invoke('backup:select-restore-file'),
});

// Expose shell API
contextBridge.exposeInMainWorld('shellAPI', {
	openPath: (targetPath: string): Promise<boolean> =>
		ipcRenderer.invoke('shell:open-path', targetPath),
});

// Expose window control API
contextBridge.exposeInMainWorld('windowAPI', {
	minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),

	maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),

	close: (): Promise<void> => ipcRenderer.invoke('window:close'),

	isMaximized: (): Promise<boolean> =>
		ipcRenderer.invoke('window:is-maximized'),
});

// Expose view API
contextBridge.exposeInMainWorld('viewAPI', {
	reload: (): Promise<void> => ipcRenderer.invoke('view:reload'),

	forceReload: (): Promise<void> => ipcRenderer.invoke('view:force-reload'),

	openDevTools: (): Promise<void> => ipcRenderer.invoke('view:dev-tools'),

	zoomIn: (): Promise<void> => ipcRenderer.invoke('view:zoom-in'),

	zoomOut: (): Promise<void> => ipcRenderer.invoke('view:zoom-out'),

	zoomReset: (): Promise<void> => ipcRenderer.invoke('view:zoom-reset'),
});
