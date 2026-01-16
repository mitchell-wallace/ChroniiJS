import { Component, createSignal, createEffect, Show } from 'solid-js';
import { isElectronRenderer } from '../env';

type ChroniiConfig = {
  backup: {
    enabled: boolean;
    format: 'db' | 'csv' | 'both';
    location: string | null;
    weeklyRetention: number;
    lastWeeklyBackup: string | null;
    lastVersion: string | null;
    versionRetention: number;
  };
};

interface DatabaseSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const DatabaseSettings: Component<DatabaseSettingsProps> = (props) => {
  const [config, setConfig] = createSignal<ChroniiConfig | null>(null);
  const [dbPath, setDbPath] = createSignal<string>('');
  const [isBusy, setIsBusy] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

  const loadSettings = async () => {
    try {
      const [configResult, dbInfo] = await Promise.all([
        window.configAPI.getConfig(),
        window.databaseAPI.getInfo(),
      ]);
      setConfig(configResult);
      setDbPath(dbInfo.path);
    } catch (error) {
      console.error('Failed to load database settings:', error);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      loadSettings();
    }
  });

  const updateBackupConfig = async (updates: Partial<ChroniiConfig['backup']>) => {
    const current = config();
    if (!current) return;
    const nextConfig = await window.configAPI.updateConfig({
      backup: {
        ...current.backup,
        ...updates,
      },
    });
    setConfig(nextConfig);
  };

  const handleOpenFolder = async () => {
    if (!isElectronRenderer()) return;
    const pathToOpen = dbPath();
    if (pathToOpen) {
      const folderPath = pathToOpen.replace(/[\\/][^\\/]+$/, '');
      await window.shellAPI.openPath(folderPath);
    }
  };

  const handleChooseBackupLocation = async () => {
    if (!isElectronRenderer()) return;
    const selected = await window.backupAPI.selectBackupLocation();
    if (selected) {
      await updateBackupConfig({ location: selected });
    }
  };

  const handleManualBackup = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await window.backupAPI.createBackup();
      setStatusMessage('Backup created successfully.');
    } catch (error) {
      console.error('Failed to create backup:', error);
      setStatusMessage('Failed to create backup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!isElectronRenderer()) {
      setStatusMessage('Restore is available in the desktop app.');
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const selected = await window.backupAPI.selectRestoreFile();
      if (!selected) return;
      await window.backupAPI.restoreBackup(selected);
      setStatusMessage('Backup restored. Restart the app if needed.');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setStatusMessage('Failed to restore backup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      if (isElectronRenderer()) {
        const suggestedName = `chronii-entries-${new Date().toISOString().slice(0, 10)}.csv`;
        const destination = await window.databaseAPI.selectCsvExportPath(suggestedName);
        if (!destination) return;
        await window.databaseAPI.exportCsv(destination);
      } else {
        await (window.databaseAPI as any).exportCsv();
      }
      setStatusMessage('CSV exported.');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      setStatusMessage('Failed to export CSV.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportCsv = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      if (isElectronRenderer()) {
        const source = await window.databaseAPI.selectCsvImportPath();
        if (!source) return;
        await window.databaseAPI.importCsv(source);
        setStatusMessage('CSV imported.');
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async () => {
          try {
            const file = input.files?.[0];
            if (!file) return;
            const csvText = await file.text();
            await (window.databaseAPI as any).importCsv(csvText);
            setStatusMessage('CSV imported.');
          } catch (error) {
            console.error('Failed to import CSV:', error);
            setStatusMessage('Failed to import CSV.');
          } finally {
            setIsBusy(false);
          }
        };
        input.click();
        return;
      }
    } catch (error) {
      console.error('Failed to import CSV:', error);
      setStatusMessage('Failed to import CSV.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]">
        <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-xl mx-4">
          <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
            <h2 class="text-lg font-semibold">Database Settings</h2>
            <button class="btn btn-sm btn-ghost" onClick={props.onClose}>Close</button>
          </div>

          <div class="p-5 space-y-5">
            <div>
              <div class="text-sm text-base-content/60 mb-1">Database path</div>
              <div class="flex items-center gap-3">
                <div class="text-sm font-mono flex-1 truncate">{dbPath()}</div>
                <Show when={isElectronRenderer()}>
                  <button class="btn btn-xs" onClick={handleOpenFolder}>Open Folder</button>
                </Show>
              </div>
            </div>

            <div class="border-t border-base-300 pt-4">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <div class="font-semibold">Automatic backups</div>
                  <div class="text-xs text-base-content/60">Weekly backups with retention</div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm"
                    checked={config()?.backup.enabled ?? true}
                    onChange={(e) => updateBackupConfig({ enabled: e.currentTarget.checked })}
                  />
                  Enabled
                </label>
              </div>

              <div class="flex items-center gap-3">
                <label class="text-sm">Retention (weeks)</label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  class="input input-sm input-bordered w-20"
                  value={config()?.backup.weeklyRetention ?? 6}
                  onInput={(e) => updateBackupConfig({ weeklyRetention: Number(e.currentTarget.value) })}
                />
                <select
                  class="select select-sm select-bordered"
                  value={config()?.backup.format ?? 'db'}
                  onChange={(e) => updateBackupConfig({ format: e.currentTarget.value as ChroniiConfig['backup']['format'] })}
                >
                  <option value="db">.db</option>
                  <option value="csv">CSV</option>
                  <option value="both">Both</option>
                </select>
                <Show when={isElectronRenderer()}>
                  <button class="btn btn-xs" onClick={handleChooseBackupLocation}>
                    Choose Backup Folder
                  </button>
                </Show>
              </div>
              <Show when={isElectronRenderer()}>
                <div class="text-xs text-base-content/60 mt-1">
                  Location: {config()?.backup.location ?? 'Default (app data backups folder)'}
                </div>
              </Show>
            </div>

            <div class="border-t border-base-300 pt-4">
              <div class="font-semibold mb-2">Actions</div>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-sm" onClick={handleManualBackup} disabled={isBusy()}>
                  Backup Now
                </button>
                <Show when={isElectronRenderer()}>
                  <button class="btn btn-sm" onClick={handleRestoreBackup} disabled={isBusy()}>
                    Restore Backup
                  </button>
                </Show>
                <button class="btn btn-sm" onClick={handleExportCsv} disabled={isBusy()}>
                  Export CSV
                </button>
                <button class="btn btn-sm" onClick={handleImportCsv} disabled={isBusy()}>
                  Import CSV
                </button>
              </div>
              <Show when={statusMessage()}>
                <div class="text-xs text-base-content/70 mt-2">{statusMessage()}</div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default DatabaseSettings;

