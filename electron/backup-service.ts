import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from './database-factory';
import type { TimeEntry } from './database-better-sqlite3';
import { getConfig, updateConfig, getDefaultBackupDirectory, type ChroniiConfig } from './config-store';

export type BackupType = 'weekly' | 'version' | 'manual';
export type RestoreMode = 'replace' | 'dedupe' | 'merge' | 'keep-newer';

export interface BackupEntry {
  type: BackupType;
  name: string;
  path: string;
  createdAt: number;
}

export type PreviewAction = 'add' | 'remove' | 'skip';

export type EntrySnapshot = {
  id?: number;
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt: number;
  updatedAt: number;
  logged: boolean;
};

export interface PreviewItem {
  action: PreviewAction;
  entry: EntrySnapshot;
  source: 'import' | 'backup' | 'current';
  incomingEntry?: EntrySnapshot;
  currentEntry?: EntrySnapshot;
}

export interface PreviewResult {
  summary: {
    adds: number;
    removes: number;
    skips: number;
    total: number;
  };
  items: PreviewItem[];
  cutoffTime?: number;
  mode?: RestoreMode;
}

const WEEKLY_BACKUP_REGEX = /^(\d{8})-chronii-database\.db\.bak$/;
const VERSION_BACKUP_REGEX = /^v(.+)-chronii-database\.db\.bak$/;
const MANUAL_BACKUP_REGEX = /^(\d{8}-\d{6})-chronii-database\.db\.bak$/;
const WEEKLY_CSV_BACKUP_REGEX = /^(\d{8})-chronii-database\.csv$/;
const VERSION_CSV_BACKUP_REGEX = /^v(.+)-chronii-database\.csv$/;

function ensureDirectory(targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

function formatDateStamp(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateTimeStamp(date: Date): string {
  const dateStamp = formatDateStamp(date);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${dateStamp}-${hours}${minutes}${seconds}`;
}

function getBackupDirectory(config: ChroniiConfig): string {
  return config.backup.location ?? getDefaultBackupDirectory();
}

async function getDatabasePath(): Promise<string> {
  const db = await getDatabase();
  return db.getInfo().path;
}

async function copyDatabaseTo(destinationPath: string): Promise<void> {
  const db = await getDatabase();
  await db.backupTo(destinationPath);
}

function escapeCsvValue(value: string): string {
  if (value.includes('"')) {
    value = value.replace(/"/g, '""');
  }
  if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
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

  const match = trimmed.match(/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function entriesToCsv(entries: TimeEntry[]): string {
  const header = ['taskName', 'startTime', 'endTime', 'createdAt', 'updatedAt', 'logged'];
  const rows = entries.map((entry) => [
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

function parseCsvEntries(csvText: string): EntrySnapshot[] {
  const rows = parseCsvRows(csvText).filter((row) => row.some((value) => value.trim() !== ''));
  if (rows.length === 0) return [];

  const header = rows[0].map((value) => value.trim());
  const indexOf = (name: string) => header.findIndex((value) => value.toLowerCase() === name.toLowerCase());

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
    const startTime = parseDateTime(row[startIndex] ?? '');
    const endValue = row[endIndex] ?? '';
    const endTime = endValue === '' ? null : parseDateTime(endValue);
    const createdValue = createdIndex >= 0 ? row[createdIndex] : '';
    const updatedValue = updatedIndex >= 0 ? row[updatedIndex] : '';
    const loggedValue = loggedIndex >= 0 ? row[loggedIndex] : '';
    const logged = loggedValue === '1' || loggedValue.toLowerCase() === 'true' || loggedValue.toLowerCase() === 'yes';

    if (startTime === null || !Number.isFinite(startTime)) {
      throw new Error('CSV contains invalid start times.');
    }

    const parsedCreated = createdValue ? parseDateTime(createdValue) : null;
    const createdAt = parsedCreated !== null ? parsedCreated : startTime;
    const parsedUpdated = updatedValue ? parseDateTime(updatedValue) : null;
    const updatedAt = parsedUpdated !== null ? parsedUpdated : createdAt;

    return {
      taskName,
      startTime,
      endTime: endTime !== null && Number.isFinite(endTime) ? endTime : null,
      createdAt,
      updatedAt,
      logged,
    };
  });
}

async function writeCsvBackup(destinationPath: string): Promise<void> {
  const db = await getDatabase();
  const entries = db.getAllTimeEntriesForExport();
  const csvText = entriesToCsv(entries);
  fs.writeFileSync(destinationPath, csvText, 'utf-8');
}

function normalizeTime(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value / 1000);
}

function getEntryKey(entry: EntrySnapshot): string {
  return JSON.stringify([
    entry.taskName,
    normalizeTime(entry.startTime),
    normalizeTime(entry.endTime ?? null),
    normalizeTime(entry.createdAt),
    normalizeTime(entry.updatedAt),
    entry.logged ? 1 : 0,
  ]);
}

function buildEntryMap(entries: EntrySnapshot[]): Map<string, EntrySnapshot> {
  const map = new Map<string, EntrySnapshot>();
  for (const entry of entries) {
    map.set(getEntryKey(entry), entry);
  }
  return map;
}

function readBackupEntries(backupPath: string): EntrySnapshot[] {
  const db = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const columns = db.prepare('PRAGMA table_info(time_entries)').all() as Array<{ name: string }>;
    const hasLogged = columns.some((column) => column.name === 'logged');
    const selectSql = hasLogged
      ? `SELECT task_name as taskName, start_time as startTime, end_time as endTime,
            created_at as createdAt, updated_at as updatedAt, logged
         FROM time_entries
         ORDER BY start_time DESC`
      : `SELECT task_name as taskName, start_time as startTime, end_time as endTime,
            created_at as createdAt, updated_at as updatedAt, 0 as logged
         FROM time_entries
         ORDER BY start_time DESC`;
    const rows = db.prepare(selectSql).all() as Array<{
      taskName: string;
      startTime: number;
      endTime: number | null;
      createdAt: number;
      updatedAt: number;
      logged: number;
    }>;

    return rows.map((row) => ({
      taskName: row.taskName,
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      logged: Boolean(row.logged),
    }));
  } finally {
    db.close();
  }
}

function buildCsvImportPreview(
  incoming: EntrySnapshot[],
  current: EntrySnapshot[],
  dedupe: boolean
): PreviewResult {
  const currentMap = buildEntryMap(current);
  const items: PreviewItem[] = [];
  let adds = 0;
  let skips = 0;

  for (const entry of incoming) {
    const key = getEntryKey(entry);
    const existing = currentMap.get(key);
    if (dedupe && existing) {
      items.push({
        action: 'skip',
        entry,
        source: 'import',
        incomingEntry: entry,
        currentEntry: existing,
      });
      skips += 1;
    } else {
      items.push({
        action: 'add',
        entry,
        source: 'import',
        incomingEntry: entry,
      });
      adds += 1;
    }
  }

  return {
    summary: {
      adds,
      removes: 0,
      skips,
      total: items.length,
    },
    items,
  };
}

function buildRestorePreview(
  backupEntries: EntrySnapshot[],
  currentEntries: EntrySnapshot[],
  mode: RestoreMode
): PreviewResult {
  const backupMap = buildEntryMap(backupEntries);
  const currentMap = buildEntryMap(currentEntries);
  const items: PreviewItem[] = [];
  let adds = 0;
  let removes = 0;
  let skips = 0;
  let cutoffTime: number | undefined;

  if (mode === 'replace') {
    for (const entry of currentEntries) {
      items.push({
        action: 'remove',
        entry,
        source: 'current',
        currentEntry: entry,
      });
      removes += 1;
    }
    for (const entry of backupEntries) {
      items.push({
        action: 'add',
        entry,
        source: 'backup',
        incomingEntry: entry,
      });
      adds += 1;
    }
  }

  if (mode === 'dedupe') {
    for (const entry of backupEntries) {
      const key = getEntryKey(entry);
      const existing = currentMap.get(key);
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
    }
  }

  if (mode === 'merge') {
    for (const entry of backupEntries) {
      items.push({
        action: 'add',
        entry,
        source: 'backup',
        incomingEntry: entry,
      });
      adds += 1;
    }
  }

  if (mode === 'keep-newer') {
    cutoffTime = backupEntries
      .map((entry) => entry.endTime ?? null)
      .filter((value): value is number => value !== null)
      .reduce((max, value) => Math.max(max, value), 0);

    for (const entry of currentEntries) {
      const isNewer = entry.endTime !== null ? entry.endTime > cutoffTime : entry.startTime > cutoffTime;
      if (isNewer) {
        const key = getEntryKey(entry);
        const existing = backupMap.get(key);
        if (existing) {
          items.push({
            action: 'skip',
            entry,
            source: 'current',
            incomingEntry: entry,
            currentEntry: existing,
          });
          skips += 1;
        }
        if (!existing) {
          items.push({
            action: 'skip',
            entry,
            source: 'current',
            incomingEntry: entry,
          });
          skips += 1;
        }
      } else {
        items.push({
          action: 'remove',
          entry,
          source: 'current',
          currentEntry: entry,
        });
        removes += 1;
      }
    }

    for (const entry of backupEntries) {
      items.push({
        action: 'add',
        entry,
        source: 'backup',
        incomingEntry: entry,
      });
      adds += 1;
    }
  }

  return {
    summary: {
      adds,
      removes,
      skips,
      total: items.length,
    },
    items,
    cutoffTime,
    mode,
  };
}

function parseBackupEntry(filePath: string): BackupEntry | null {
  const name = path.basename(filePath);
  const weeklyMatch = name.match(WEEKLY_BACKUP_REGEX);
  if (weeklyMatch) {
    const dateValue = weeklyMatch[1];
    const createdAt = Date.parse(`${dateValue.substring(0, 4)}-${dateValue.substring(4, 6)}-${dateValue.substring(6, 8)}T00:00:00Z`);
    return { type: 'weekly', name, path: filePath, createdAt };
  }

  const versionMatch = name.match(VERSION_BACKUP_REGEX);
  if (versionMatch) {
    const stat = fs.statSync(filePath);
    return { type: 'version', name, path: filePath, createdAt: stat.mtimeMs };
  }

  const manualMatch = name.match(MANUAL_BACKUP_REGEX);
  if (manualMatch) {
    const dateValue = manualMatch[1];
    const createdAt = Date.parse(
      `${dateValue.substring(0, 4)}-${dateValue.substring(4, 6)}-${dateValue.substring(6, 8)}T${dateValue.substring(9, 11)}:${dateValue.substring(11, 13)}:${dateValue.substring(13, 15)}Z`
    );
    return { type: 'manual', name, path: filePath, createdAt };
  }

  return null;
}

function parseCsvBackupEntry(filePath: string): BackupEntry | null {
  const name = path.basename(filePath);
  const weeklyMatch = name.match(WEEKLY_CSV_BACKUP_REGEX);
  if (weeklyMatch) {
    const dateValue = weeklyMatch[1];
    const createdAt = Date.parse(`${dateValue.substring(0, 4)}-${dateValue.substring(4, 6)}-${dateValue.substring(6, 8)}T00:00:00Z`);
    return { type: 'weekly', name, path: filePath, createdAt };
  }

  const versionMatch = name.match(VERSION_CSV_BACKUP_REGEX);
  if (versionMatch) {
    const stat = fs.statSync(filePath);
    return { type: 'version', name, path: filePath, createdAt: stat.mtimeMs };
  }

  return null;
}

function listBackupFiles(backupDir: string): BackupEntry[] {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .map((fileName) => path.join(backupDir, fileName))
    .filter((filePath) => filePath.endsWith('.db.bak'))
    .map(parseBackupEntry)
    .filter((entry): entry is BackupEntry => Boolean(entry))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function listCsvBackupFiles(backupDir: string): BackupEntry[] {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .map((fileName) => path.join(backupDir, fileName))
    .filter((filePath) => filePath.endsWith('.csv'))
    .map(parseCsvBackupEntry)
    .filter((entry): entry is BackupEntry => Boolean(entry))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function pruneWeeklyBackups(backupDir: string, retention: number): void {
  const weeklyBackups = listBackupFiles(backupDir).filter((entry) => entry.type === 'weekly');
  if (weeklyBackups.length <= retention) return;

  const toRemove = weeklyBackups.slice(retention);
  for (const entry of toRemove) {
    fs.unlinkSync(entry.path);
  }
}

function pruneWeeklyCsvBackups(backupDir: string, retention: number): void {
  const weeklyBackups = listCsvBackupFiles(backupDir).filter((entry) => entry.type === 'weekly');
  if (weeklyBackups.length <= retention) return;

  const toRemove = weeklyBackups.slice(retention);
  for (const entry of toRemove) {
    fs.unlinkSync(entry.path);
  }
}

function pruneVersionBackups(backupDir: string, retention: number): void {
  const versionBackups = listBackupFiles(backupDir).filter((entry) => entry.type === 'version');
  if (versionBackups.length <= retention) return;

  const toRemove = versionBackups.slice(retention);
  for (const entry of toRemove) {
    fs.unlinkSync(entry.path);
  }
}

function pruneVersionCsvBackups(backupDir: string, retention: number): void {
  const versionBackups = listCsvBackupFiles(backupDir).filter((entry) => entry.type === 'version');
  if (versionBackups.length <= retention) return;

  const toRemove = versionBackups.slice(retention);
  for (const entry of toRemove) {
    fs.unlinkSync(entry.path);
  }
}

export async function createWeeklyBackup(config: ChroniiConfig): Promise<BackupEntry | null> {
  if (!config.backup.enabled) return null;

  const backupDir = getBackupDirectory(config);
  ensureDirectory(backupDir);

  const format = config.backup.format ?? 'db';
  const shouldWriteDb = format !== 'csv';
  const shouldWriteCsv = format !== 'db';
  const dateStamp = formatDateStamp(new Date());

  let entry: BackupEntry | null = null;

  if (shouldWriteDb) {
    const fileName = `${dateStamp}-chronii-database.db.bak`;
    const destinationPath = path.join(backupDir, fileName);
    await copyDatabaseTo(destinationPath);
    pruneWeeklyBackups(backupDir, config.backup.weeklyRetention);
    entry = parseBackupEntry(destinationPath) ?? null;
  }

  if (shouldWriteCsv) {
    const csvName = `${dateStamp}-chronii-database.csv`;
    const csvPath = path.join(backupDir, csvName);
    await writeCsvBackup(csvPath);
    pruneWeeklyCsvBackups(backupDir, config.backup.weeklyRetention);
  }

  return entry;
}

export async function createVersionBackup(config: ChroniiConfig, version: string): Promise<BackupEntry | null> {
  if (!config.backup.enabled) return null;

  const backupDir = getBackupDirectory(config);
  ensureDirectory(backupDir);

  const sanitizedVersion = version.replace(/[^\w.\-]/g, '_');
  const format = config.backup.format ?? 'db';
  const shouldWriteDb = format !== 'csv';
  const shouldWriteCsv = format !== 'db';

  let entry: BackupEntry | null = null;

  if (shouldWriteDb) {
    const fileName = `v${sanitizedVersion}-chronii-database.db.bak`;
    const destinationPath = path.join(backupDir, fileName);
    await copyDatabaseTo(destinationPath);
    pruneVersionBackups(backupDir, config.backup.versionRetention);
    entry = parseBackupEntry(destinationPath) ?? null;
  }

  if (shouldWriteCsv) {
    const csvName = `v${sanitizedVersion}-chronii-database.csv`;
    const csvPath = path.join(backupDir, csvName);
    await writeCsvBackup(csvPath);
    pruneVersionCsvBackups(backupDir, config.backup.versionRetention);
  }

  return entry;
}

export async function createManualBackup(): Promise<BackupEntry | null> {
  const config = getConfig();
  if (!config.backup.enabled) return null;

  const backupDir = getDefaultBackupDirectory();
  ensureDirectory(backupDir);

  const fileName = `${formatDateTimeStamp(new Date())}-chronii-database.db.bak`;
  const destinationPath = path.join(backupDir, fileName);
  await copyDatabaseTo(destinationPath);

  const entry = parseBackupEntry(destinationPath);
  return entry ?? null;
}

export async function runStartupBackups(): Promise<void> {
  const config = getConfig();
  if (!config.backup.enabled) return;

  const backupDir = getBackupDirectory(config);
  ensureDirectory(backupDir);

  const now = new Date();
  const lastWeekly = config.backup.lastWeeklyBackup ? new Date(config.backup.lastWeeklyBackup) : null;
  const needsWeekly = !lastWeekly || now.getTime() - lastWeekly.getTime() >= 7 * 24 * 60 * 60 * 1000;

  if (needsWeekly) {
    await createWeeklyBackup(config);
    updateConfig({
      backup: {
        lastWeeklyBackup: now.toISOString(),
      },
    });
  }

  const currentVersion = app.getVersion();
  if (config.backup.lastVersion !== currentVersion) {
    await createVersionBackup(config, currentVersion);
    updateConfig({
      backup: {
        lastVersion: currentVersion,
      },
    });
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  const config = getConfig();
  const backupDir = getBackupDirectory(config);
  return listBackupFiles(backupDir);
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const dbPath = await getDatabasePath();
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  closeDatabase();
  fs.copyFileSync(backupPath, dbPath);

  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
  }
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
  }

  await getDatabase();
}

export async function exportDatabase(destinationPath: string): Promise<void> {
  await copyDatabaseTo(destinationPath);
}

export async function importDatabase(sourcePath: string): Promise<void> {
  await restoreBackup(sourcePath);
}

export async function exportCsv(destinationPath: string): Promise<void> {
  await writeCsvBackup(destinationPath);
}

export async function importCsv(sourcePath: string, options?: { dedupe?: boolean }): Promise<void> {
  const csvText = fs.readFileSync(sourcePath, 'utf-8');
  const entries = parseCsvEntries(csvText);
  const db = await getDatabase();
  const dedupe = options?.dedupe ?? true;
  if (dedupe) {
    const currentEntries = db.getAllTimeEntriesForExport().map((entry) => ({
      id: entry.id,
      taskName: entry.taskName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      logged: entry.logged,
    }));
    const currentMap = buildEntryMap(currentEntries);
    const filtered = entries.filter((entry) => !currentMap.has(getEntryKey(entry)));
    db.importTimeEntries(filtered);
  } else {
    db.importTimeEntries(entries);
  }
}

export async function previewImportCsv(sourcePath: string, options?: { dedupe?: boolean }): Promise<PreviewResult> {
  const csvText = fs.readFileSync(sourcePath, 'utf-8');
  const entries = parseCsvEntries(csvText);
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
  return buildCsvImportPreview(entries, currentEntries, options?.dedupe ?? true);
}

export async function previewRestoreBackup(backupPath: string, mode: RestoreMode): Promise<PreviewResult> {
  const backupEntries = readBackupEntries(backupPath);
  const db = await getDatabase();
  const currentEntries = db.getAllTimeEntriesForExport().map((entry) => ({
    taskName: entry.taskName,
    startTime: entry.startTime,
    endTime: entry.endTime,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    logged: entry.logged,
  }));
  return buildRestorePreview(backupEntries, currentEntries, mode);
}

export async function restoreBackupWithMode(backupPath: string, mode: RestoreMode): Promise<void> {
  if (mode === 'replace') {
    await restoreBackup(backupPath);
    return;
  }

  if (mode === 'dedupe') {
    const backupEntries = readBackupEntries(backupPath);
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
    const currentMap = buildEntryMap(currentEntries);
    const toAdd = backupEntries.filter((entry) => !currentMap.has(getEntryKey(entry)));
    db.importTimeEntries(toAdd);
    return;
  }

  if (mode === 'merge') {
    const backupEntries = readBackupEntries(backupPath);
    const db = await getDatabase();
    db.importTimeEntries(backupEntries);
    return;
  }

  const backupEntries = readBackupEntries(backupPath);
  const cutoffTime = backupEntries
    .map((entry) => entry.endTime ?? null)
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);

  const db = await getDatabase();
  const currentEntries = db.getAllTimeEntriesForExport();
  const keepEntries = currentEntries
    .filter((entry) => entry.endTime !== null ? entry.endTime > cutoffTime : entry.startTime > cutoffTime)
    .map((entry) => ({
      id: entry.id,
      taskName: entry.taskName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      logged: entry.logged,
    }));

  await restoreBackup(backupPath);
  const restoredDb = await getDatabase();
  const backupMap = buildEntryMap(backupEntries);
  const toAdd = keepEntries.filter((entry) => !backupMap.has(getEntryKey(entry)));
  restoredDb.importTimeEntries(toAdd);
}

function getCleanupCandidates(): Array<{ path: string; name: string; size: number }> {
  const config = getConfig();
  const backupDir = getBackupDirectory(config);

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const entries = listBackupFiles(backupDir);
  const toDelete = new Set<string>();

  const weekly = entries.filter((entry) => entry.type === 'weekly');
  weekly.sort((a, b) => b.createdAt - a.createdAt);
  weekly.slice(config.backup.weeklyRetention).forEach((entry) => toDelete.add(entry.path));

  const versions = entries.filter((entry) => entry.type === 'version');
  versions.sort((a, b) => b.createdAt - a.createdAt);
  versions.slice(config.backup.versionRetention).forEach((entry) => toDelete.add(entry.path));

  const manual = entries.filter((entry) => entry.type === 'manual');
  const cutoff = Date.now() - config.backup.weeklyRetention * 7 * 24 * 60 * 60 * 1000;
  manual.filter((entry) => entry.createdAt < cutoff).forEach((entry) => toDelete.add(entry.path));

  return Array.from(toDelete).map((filePath) => {
    const stat = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
    };
  }).sort((a, b) => b.size - a.size);
}

export async function previewCleanupBackups(): Promise<{
  backupDir: string;
  totalFiles: number;
  totalBytes: number;
  files: Array<{ name: string; path: string; size: number }>;
}> {
  const config = getConfig();
  const backupDir = getBackupDirectory(config);
  const files = getCleanupCandidates();
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return {
    backupDir,
    totalFiles: files.length,
    totalBytes,
    files,
  };
}

export async function cleanupBackups(): Promise<{ deleted: number; backupDir: string; freedBytes: number }> {
  const config = getConfig();
  const backupDir = getBackupDirectory(config);

  if (!fs.existsSync(backupDir)) {
    return { deleted: 0, backupDir, freedBytes: 0 };
  }

  const candidates = getCleanupCandidates();
  let deleted = 0;
  let freedBytes = 0;
  for (const file of candidates) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      deleted += 1;
      freedBytes += file.size;
    }
  }

  return { deleted, backupDir, freedBytes };
}

