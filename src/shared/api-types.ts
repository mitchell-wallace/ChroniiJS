export interface TimeEntry {
	id: string;
	taskName: string;
	startTime: number;
	endTime: number | null;
	createdAt: number;
	updatedAt: number;
	logged: boolean;
}

export type TimeEntryUpdate = Partial<
	Pick<TimeEntry, 'taskName' | 'startTime' | 'endTime' | 'logged'>
>;

export interface DatabaseInfo {
	path: string;
	isOpen: boolean;
}

export interface ImportOptions {
	dedupe?: boolean;
}

export type BackupFormat = 'db' | 'csv' | 'both';
export type ReminderBackupFormat = Exclude<BackupFormat, 'both'>;
export type BackupType = 'weekly' | 'version' | 'manual';
export type RestoreMode = 'replace' | 'dedupe' | 'merge' | 'keep-newer';
export type PreviewAction = 'add' | 'remove' | 'skip' | 'rollback';

export interface BackupConfig {
	enabled: boolean;
	format: BackupFormat;
	location: string | null;
	weeklyRetention: number;
	lastWeeklyBackup: string | null;
	lastVersion: string | null;
	versionRetention: number;
	reminders?: {
		enabled: boolean;
		dayOfWeek: number;
		format: ReminderBackupFormat;
		lastDismissed: string | null;
	};
}

export interface ChroniiConfig {
	backup: BackupConfig;
}

export type ChroniiConfigUpdate = {
	[K in keyof ChroniiConfig]?: Partial<ChroniiConfig[K]>;
};

export interface BackupEntry {
	type: BackupType;
	name: string;
	path: string;
	createdAt: number;
}

export interface PreviewEntrySnapshot {
	id?: string;
	taskName: string;
	startTime: number;
	endTime: number | null;
	createdAt: number;
	updatedAt: number;
	logged: boolean;
}

export interface PreviewItem {
	action: PreviewAction;
	entry: PreviewEntrySnapshot;
	source: 'import' | 'backup' | 'current';
	incomingEntry?: PreviewEntrySnapshot;
	currentEntry?: PreviewEntrySnapshot;
	selectedByDefault?: boolean;
}

export interface PreviewResult {
	summary: {
		adds: number;
		removes: number;
		rollbacks?: number;
		skips: number;
		total: number;
	};
	items: PreviewItem[];
	cutoffTime?: number;
	mode?: RestoreMode;
}

export interface ApplyChangesPayload {
	adds?: PreviewEntrySnapshot[];
	removes?: PreviewEntrySnapshot[];
	updates?: PreviewEntrySnapshot[];
}

export interface BackupCleanupPreview {
	backupDir: string;
	totalFiles: number;
	totalBytes: number;
	files: Array<{ name: string; path: string; size: number }>;
}

export interface BackupCleanupResult {
	deleted: number;
	backupDir: string;
	freedBytes?: number;
}
