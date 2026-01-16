import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getDatabase, closeDatabase } from './database-factory';
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

function pruneWeeklyBackups(backupDir: string, retention: number): void {
  const weeklyBackups = listBackupFiles(backupDir).filter((entry) => entry.type === 'weekly');
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

export async function createWeeklyBackup(config: ChroniiConfig): Promise<BackupEntry | null> {
  if (!config.backup.enabled) return null;

  const backupDir = getBackupDirectory(config);
  ensureDirectory(backupDir);

  const fileName = `${formatDateStamp(new Date())}-chronii-database.db.bak`;
  const destinationPath = path.join(backupDir, fileName);
  await copyDatabaseTo(destinationPath);

  pruneWeeklyBackups(backupDir, config.backup.weeklyRetention);

  const entry = parseBackupEntry(destinationPath);
  return entry ?? null;
}

export async function createVersionBackup(config: ChroniiConfig, version: string): Promise<BackupEntry | null> {
  if (!config.backup.enabled) return null;

  const backupDir = getBackupDirectory(config);
  ensureDirectory(backupDir);

  const sanitizedVersion = version.replace(/[^\w.\-]/g, '_');
  const fileName = `v${sanitizedVersion}-chronii-database.db.bak`;
  const destinationPath = path.join(backupDir, fileName);
  await copyDatabaseTo(destinationPath);

  pruneVersionBackups(backupDir, config.backup.versionRetention);

  const entry = parseBackupEntry(destinationPath);
  return entry ?? null;
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

