import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface BackupConfig {
  enabled: boolean;
  location: string | null;
  weeklyRetention: number;
  lastWeeklyBackup: string | null;
  lastVersion: string | null;
  versionRetention: number;
}

export interface ChroniiConfig {
  backup: BackupConfig;
}

const DEFAULT_CONFIG: ChroniiConfig = {
  backup: {
    enabled: true,
    location: null,
    weeklyRetention: 6,
    lastWeeklyBackup: null,
    lastVersion: null,
    versionRetention: 2,
  },
};

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'chronii-config.json');
}

function ensureConfigDirExists(configPath: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mergeConfig(current: ChroniiConfig, updates: Partial<ChroniiConfig>): ChroniiConfig {
  return {
    ...current,
    ...updates,
    backup: {
      ...current.backup,
      ...(updates.backup ?? {}),
    },
  };
}

export function loadConfig(): ChroniiConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ChroniiConfig>;
      return mergeConfig(DEFAULT_CONFIG, parsed);
    }
  } catch (error) {
    console.warn('Failed to read config, using defaults:', error);
  }

  saveConfig(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: ChroniiConfig): void {
  const configPath = getConfigPath();
  ensureConfigDirExists(configPath);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getConfig(): ChroniiConfig {
  return loadConfig();
}

export function setConfig(nextConfig: ChroniiConfig): ChroniiConfig {
  const merged = mergeConfig(DEFAULT_CONFIG, nextConfig);
  saveConfig(merged);
  return merged;
}

export function updateConfig(updates: Partial<ChroniiConfig>): ChroniiConfig {
  const current = loadConfig();
  const merged = mergeConfig(current, updates);
  saveConfig(merged);
  return merged;
}

export function getDefaultBackupDirectory(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
}

