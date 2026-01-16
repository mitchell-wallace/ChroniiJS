import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getDatabase, closeDatabase } from './database-factory';
import type { TimeEntry } from './database-better-sqlite3';
import { getConfig, updateConfig, getDefaultBackupDirectory, type ChroniiConfig } from './config-store';

export type BackupType = 'weekly' | 'version' | 'manual';

export interface BackupEntry {
  type: BackupType;
  name: string;
  path: string;
  createdAt: number;
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

function entriesToCsv(entries: TimeEntry[]): string {
  const header = ['taskName', 'startTime', 'endTime', 'createdAt', 'updatedAt', 'logged'];
  const rows = entries.map((entry) => [
    escapeCsvValue(entry.taskName),
    String(entry.startTime),
    entry.endTime === null ? '' : String(entry.endTime),
    String(entry.createdAt),
    String(entry.updatedAt),
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
  taskName: string;
  startTime: number;
  endTime: number | null;
  createdAt?: number;
  updatedAt?: number;
  logged?: boolean;
}> {
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
    const startTime = Number(row[startIndex]);
    const endValue = row[endIndex] ?? '';
    const endTime = endValue === '' ? null : Number(endValue);
    const createdValue = createdIndex >= 0 ? row[createdIndex] : '';
    const updatedValue = updatedIndex >= 0 ? row[updatedIndex] : '';
    const loggedValue = loggedIndex >= 0 ? row[loggedIndex] : '';
    const logged = loggedValue === '1' || loggedValue.toLowerCase() === 'true' || loggedValue.toLowerCase() === 'yes';

    if (!Number.isFinite(startTime)) {
      throw new Error('CSV contains invalid start times.');
    }

    return {
      taskName,
      startTime,
      endTime: Number.isFinite(endTime) ? endTime : null,
      createdAt: Number.isFinite(Number(createdValue)) ? Number(createdValue) : undefined,
      updatedAt: Number.isFinite(Number(updatedValue)) ? Number(updatedValue) : undefined,
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

  const backupDir = getBackupDirectory(config);
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

export async function importCsv(sourcePath: string): Promise<void> {
  const csvText = fs.readFileSync(sourcePath, 'utf-8');
  const entries = parseCsvEntries(csvText);
  const db = await getDatabase();
  db.importTimeEntries(entries);
}

