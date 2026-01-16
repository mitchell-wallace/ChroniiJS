
import { Component, createSignal, createEffect, Show } from 'solid-js';
import { isElectronRenderer } from '../env';
import ConfirmDialog from './ConfirmDialog';

type ChroniiConfig = {
  backup: {
    enabled: boolean;
    format: 'db' | 'csv' | 'both';
    location: string | null;
    weeklyRetention: number;
    lastWeeklyBackup: string | null;
    lastVersion: string | null;
    versionRetention: number;
    reminders?: {
      enabled: boolean;
      dayOfWeek: number;
      format: 'db' | 'csv';
      lastDismissed: string | null;
    };
  };
};

interface DatabaseSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type RestoreMode = 'replace' | 'merge' | 'keep-newer';

type CsvImportSource =
  | { type: 'path'; value: string }
  | { type: 'text'; value: string; name?: string };

type WebRestoreSource = { name: string; buffer: Uint8Array };

type PreviewContext =
  | { type: 'csv-import'; source: CsvImportSource; dedupe: boolean }
  | { type: 'restore'; sourcePath: string; mode: 'replace' | 'dedupe' | 'merge' | 'keep-newer' };

const DatabaseSettings: Component<DatabaseSettingsProps> = (props) => {
  const [config, setConfig] = createSignal<ChroniiConfig | null>(null);
  const [dbPath, setDbPath] = createSignal<string>('');
  const [isBusy, setIsBusy] = createSignal(false);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [statusActionLabel, setStatusActionLabel] = createSignal<string | null>(null);
  const [statusActionPath, setStatusActionPath] = createSignal<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = createSignal(false);
  const [showCsvImportModal, setShowCsvImportModal] = createSignal(false);
  const [csvImportSource, setCsvImportSource] = createSignal<CsvImportSource | null>(null);
  const [csvImportDedupe, setCsvImportDedupe] = createSignal(true);
  const [csvImportDryRun, setCsvImportDryRun] = createSignal(true);
  const [csvImportError, setCsvImportError] = createSignal<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = createSignal(false);
  const [restoreSourcePath, setRestoreSourcePath] = createSignal<string | null>(null);
  const [restoreSourceBuffer, setRestoreSourceBuffer] = createSignal<WebRestoreSource | null>(null);
  const [restoreMode, setRestoreMode] = createSignal<RestoreMode>('keep-newer');
  const [restoreSkipDuplicates, setRestoreSkipDuplicates] = createSignal(true);
  const [restoreDryRun, setRestoreDryRun] = createSignal(true);
  const [restoreError, setRestoreError] = createSignal<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = createSignal(false);
  const [previewData, setPreviewData] = createSignal<any | null>(null);
  const [previewContext, setPreviewContext] = createSignal<PreviewContext | null>(null);
  const [previewSelections, setPreviewSelections] = createSignal<Set<number>>(new Set());
  const [showCleanupModal, setShowCleanupModal] = createSignal(false);
  const [cleanupPreview, setCleanupPreview] = createSignal<any | null>(null);
  const [cleanupError, setCleanupError] = createSignal<string | null>(null);

  const notifyDataSourceUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronii:data-source-updated'));
    }
  };

  const resetStatus = () => {
    setStatusMessage(null);
    setStatusActionLabel(null);
    setStatusActionPath(null);
  };

  const setStatus = (message: string, actionLabel?: string | null, actionPath?: string | null) => {
    setStatusMessage(message);
    setStatusActionLabel(actionLabel ?? null);
    setStatusActionPath(actionPath ?? null);
  };

  const formatPreviewTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatEntryDetail = (entry: { taskName: string; startTime: number; endTime: number | null }) => {
    const start = formatPreviewTime(entry.startTime);
    const end = entry.endTime ? formatPreviewTime(entry.endTime) : 'running';
    const name = entry.taskName?.trim() ? entry.taskName : '(untitled)';
    return `${name} | ${start} -> ${end}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const reminderDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getPreviewActionTooltip = (item: any) => {
    if (item.action === 'add') {
      const sourceLabel = item.source === 'current' ? 'current data' : item.source;
      return `Will add entry from ${sourceLabel}:\n${formatEntryDetail(item.incomingEntry ?? item.entry)}`;
    }
    if (item.action === 'remove') {
      return `Will remove current entry:\n${formatEntryDetail(item.currentEntry ?? item.entry)}`;
    }
    const incoming = item.incomingEntry ? formatEntryDetail(item.incomingEntry) : 'n/a';
    const current = item.currentEntry ? formatEntryDetail(item.currentEntry) : 'n/a';
    return `Matching entry found. This row will be skipped.\nIncoming: ${incoming}\nCurrent: ${current}`;
  };

  const previewItems = () => previewData()?.items ?? [];

  const initializePreviewSelection = (items: any[]) => {
    const selection = new Set<number>();
    items.forEach((item, index) => {
      if (item.action !== 'skip') {
        selection.add(index);
      }
    });
    setPreviewSelections(selection);
  };

  const togglePreviewSelection = (index: number) => {
    const selection = new Set(previewSelections());
    if (selection.has(index)) {
      selection.delete(index);
    } else {
      selection.add(index);
    }
    setPreviewSelections(selection);
  };

  const toggleSelectAll = (checked: boolean) => {
    const selection = new Set<number>();
    if (checked) {
      previewItems().forEach((item: any, index: number) => {
        if (item.action !== 'skip') {
          selection.add(index);
        }
      });
    }
    setPreviewSelections(selection);
  };

  const selectedCounts = () => {
    let adds = 0;
    let removes = 0;
    const selection = previewSelections();
    previewItems().forEach((item: any, index: number) => {
      if (!selection.has(index)) return;
      if (item.action === 'add') adds += 1;
      if (item.action === 'remove') removes += 1;
    });
    return { adds, removes };
  };

  const isAllSelected = () => {
    const selection = previewSelections();
    const selectable = previewItems().filter((item: any) => item.action !== 'skip').length;
    return selectable > 0 && selection.size === selectable;
  };

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chronii:config-updated'));
    }
  };

  const remindersConfig = () => (
    config()?.backup.reminders ?? {
      enabled: false,
      dayOfWeek: 5,
      format: 'db',
      lastDismissed: null,
    }
  );

  const updateReminderConfig = async (updates: Partial<NonNullable<ChroniiConfig['backup']['reminders']>>) => {
    const current = remindersConfig();
    await updateBackupConfig({
      reminders: {
        ...current,
        ...updates,
      },
    });
  };

  const handleOpenFolder = async () => {
    if (!isElectronRenderer()) return;
    const pathToOpen = dbPath();
    if (pathToOpen) {
      const folderPath = pathToOpen.replace(/[\\/][^\\/]+$/, '');
      await window.shellAPI.openPath(folderPath);
    }
  };

  const handleOpenStatusFolder = async () => {
    if (!isElectronRenderer()) return;
    const targetPath = statusActionPath();
    if (targetPath) {
      await window.shellAPI.openPath(targetPath);
    }
  };

  const handleChooseBackupLocation = async () => {
    if (!isElectronRenderer()) return;
    const selected = await window.backupAPI.selectBackupLocation();
    if (selected) {
      await updateBackupConfig({ location: selected });
    }
  };

  const handleRestoreDefaultLocation = async () => {
    await updateBackupConfig({ location: null });
  };

  const handleManualBackup = async () => {
    setIsBusy(true);
    resetStatus();
    try {
      const result = await window.backupAPI.createBackup();
      if (result?.path) {
        const folderPath = result.path.replace(/[\\/][^\\/]+$/, '');
        setStatus(`Backup created: ${result.path}`, 'Open folder', folderPath);
      } else {
        setStatus('Backups are disabled. Enable automatic backups to create a manual backup.');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      setStatus('Failed to create backup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setIsBusy(true);
    resetStatus();
    try {
      if (isElectronRenderer()) {
        const suggestedName = `chronii-entries-${new Date().toISOString().slice(0, 10)}.csv`;
        const destination = await window.databaseAPI.selectCsvExportPath(suggestedName);
        if (!destination) return;
        await window.databaseAPI.exportCsv(destination);
        const folderPath = destination.replace(/[\\/][^\\/]+$/, '');
        setStatus(`CSV exported: ${destination}`, 'Open folder', folderPath);
      } else {
        await (window.databaseAPI as any).exportCsv();
        setStatus('CSV exported to your downloads folder.');
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      setStatus('Failed to export CSV.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadDb = async () => {
    setIsBusy(true);
    resetStatus();
    try {
      await (window.databaseAPI as any).exportDatabase();
      setStatus('Database downloaded to your browser downloads.');
    } catch (error) {
      console.error('Failed to download database:', error);
      setStatus('Failed to download database.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreDb = async () => {
    setShowRestoreModal(true);
    setRestoreError(null);
  };

  const handleSelectCsvImport = async () => {
    setCsvImportError(null);
    if (isElectronRenderer()) {
      const selected = await window.databaseAPI.selectCsvImportPath();
      if (selected) {
        setCsvImportSource({ type: 'path', value: selected });
      }
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const csvText = await file.text();
      setCsvImportSource({ type: 'text', value: csvText, name: file.name });
    };
    input.click();
  };

  const runCsvImport = async (source: CsvImportSource, dedupe: boolean) => {
    if (source.type === 'path') {
      await window.databaseAPI.importCsv(source.value, { dedupe });
    } else {
      await (window.databaseAPI as any).importCsv(source.value, { dedupe });
    }
  };

  const runCsvImportPreview = async (source: CsvImportSource, dedupe: boolean) => {
    if (source.type === 'path') {
      return window.databaseAPI.previewImportCsv(source.value, { dedupe });
    }
    return (window.databaseAPI as any).previewImportCsv(source.value, { dedupe });
  };

  const handleImportCsvAction = async () => {
    const source = csvImportSource();
    if (!source) {
      setCsvImportError('Choose a CSV file to import.');
      return;
    }
    setCsvImportError(null);
    setIsBusy(true);
    resetStatus();
    try {
      if (csvImportDryRun()) {
        const preview = await runCsvImportPreview(source, csvImportDedupe());
        setPreviewData(preview);
        initializePreviewSelection(preview.items ?? []);
        setPreviewContext({ type: 'csv-import', source, dedupe: csvImportDedupe() });
        setShowPreviewModal(true);
        setShowCsvImportModal(false);
      } else {
        await runCsvImport(source, csvImportDedupe());
        setStatus('CSV imported. Your current data has been updated.');
        notifyDataSourceUpdated();
        setShowCsvImportModal(false);
      }
    } catch (error) {
      console.error('Failed to import CSV:', error);
      setCsvImportError('Failed to import CSV.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectRestoreFile = async () => {
    setRestoreError(null);
    if (!isElectronRenderer()) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.db';
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const buffer = new Uint8Array(await file.arrayBuffer());
          setRestoreSourceBuffer({ name: file.name, buffer });
        } catch (error) {
          console.error('Failed to read database file:', error);
          setRestoreError('Failed to read database file.');
        }
      };
      input.click();
      return;
    }
    const selected = await window.backupAPI.selectRestoreFile();
    if (selected) {
      setRestoreSourcePath(selected);
    }
  };

  const resolveRestoreMode = () => {
    if (restoreMode() === 'merge') {
      return restoreSkipDuplicates() ? 'dedupe' : 'merge';
    }
    return restoreMode();
  };

  const runRestore = async (mode: 'replace' | 'dedupe' | 'merge' | 'keep-newer') => {
    if (isElectronRenderer()) {
      const sourcePath = restoreSourcePath();
      if (!sourcePath) throw new Error('No backup file selected.');
      await window.backupAPI.restoreBackupWithOptions(sourcePath, mode);
      return;
    }
    const buffer = restoreSourceBuffer();
    if (!buffer) throw new Error('No database file selected.');
    await (window.databaseAPI as any).restoreDbWithOptions(buffer.buffer, mode);
  };

  const runRestorePreview = async (mode: 'replace' | 'dedupe' | 'merge' | 'keep-newer') => {
    if (isElectronRenderer()) {
      const sourcePath = restoreSourcePath();
      if (!sourcePath) throw new Error('No backup file selected.');
      return window.backupAPI.previewRestore(sourcePath, mode);
    }
    const buffer = restoreSourceBuffer();
    if (!buffer) throw new Error('No database file selected.');
    return (window.databaseAPI as any).previewRestoreDb(buffer.buffer, mode);
  };

  const handleRestoreAction = async () => {
    if (isElectronRenderer()) {
      if (!restoreSourcePath()) {
        setRestoreError('Choose a backup file to restore.');
        return;
      }
    } else if (!restoreSourceBuffer()) {
      setRestoreError('Choose a database file to restore.');
      return;
    }
    setRestoreError(null);
    setIsBusy(true);
    resetStatus();
    try {
      const mode = resolveRestoreMode();
      if (restoreDryRun()) {
        const preview = await runRestorePreview(mode);
        setPreviewData(preview);
        initializePreviewSelection(preview.items ?? []);
        setPreviewContext({ type: 'restore', sourcePath: restoreSourcePath() ?? restoreSourceBuffer()?.name ?? 'database', mode });
        setShowPreviewModal(true);
        setShowRestoreModal(false);
      } else {
        await runRestore(mode);
        const sourceLabel = restoreSourcePath() ?? restoreSourceBuffer()?.name ?? 'database';
        setStatus(`Backup restored from ${sourceLabel}. Your data has been updated.`);
        notifyDataSourceUpdated();
        setShowRestoreModal(false);
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setRestoreError('Failed to restore backup.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCleanupBackups = async () => {
    setCleanupError(null);
    setIsBusy(true);
    try {
      const preview = await window.backupAPI.previewCleanup();
      setCleanupPreview(preview);
      setShowCleanupModal(true);
    } catch (error) {
      console.error('Failed to preview cleanup:', error);
      setCleanupError('Failed to preview cleanup.');
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCleanupBackups = async () => {
    setIsBusy(true);
    resetStatus();
    try {
      const result = await window.backupAPI.cleanupBackups();
      if (result?.backupDir) {
        const freed = result.freedBytes ? ` Freed ${formatBytes(result.freedBytes)}.` : '';
        setStatus(
          `Cleanup complete. Removed ${result.deleted} backup files from ${result.backupDir}.${freed}`,
          'Open folder',
          result.backupDir
        );
      } else {
        setStatus('Cleanup complete.');
      }
    } catch (error) {
      console.error('Failed to clean up backups:', error);
      setStatus('Failed to clean up backups.');
    } finally {
      setIsBusy(false);
      setShowCleanupModal(false);
    }
  };

  const handlePreviewConfirm = async () => {
    const context = previewContext();
    const items = previewItems();
    if (!context) {
      setShowPreviewModal(false);
      return;
    }

    const selection = previewSelections();
    const adds = items
      .map((item: any, index: number) => ({ item, index }))
      .filter(({ item, index }) => selection.has(index) && item.action === 'add')
      .map(({ item }) => item.entry);
    const removes = items
      .map((item: any, index: number) => ({ item, index }))
      .filter(({ item, index }) => selection.has(index) && item.action === 'remove')
      .map(({ item }) => item.entry);

    setIsBusy(true);
    resetStatus();
    try {
      if (adds.length > 0 || removes.length > 0) {
        await window.databaseAPI.applyChanges({ adds, removes });
        notifyDataSourceUpdated();
      }

      if (context.type === 'csv-import') {
        setStatus('CSV import applied to the selected rows.');
      } else {
        setStatus(`Restore applied from ${context.sourcePath}.`);
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
      setStatus('Failed to apply changes.');
    } finally {
      setIsBusy(false);
      setShowPreviewModal(false);
    }
  };

  const handleClearAllData = async () => {
    setIsBusy(true);
    resetStatus();
    try {
      await window.databaseAPI.clearAllData();
      setStatus('All data cleared.');
      notifyDataSourceUpdated();
    } catch (error) {
      console.error('Failed to clear data:', error);
      setStatus('Failed to clear data.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            props.onClose();
          }
        }}
      >
        <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-xl mx-4">
          <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
            <h2 class="text-lg font-semibold">Database Settings</h2>
            <button class="btn btn-sm btn-ghost" onClick={props.onClose} title="Close">Close</button>
          </div>

          <div class="p-5 space-y-5">
            <div>
              <div class="text-sm text-base-content/60 mb-1">Database location</div>
              <div class="flex items-center gap-3">
                <Show when={isElectronRenderer()} fallback={(
                  <div class="text-sm text-base-content/70 flex-1">
                    Stored in your browser (local storage).
                  </div>
                )}>
                  <div class="text-sm font-mono flex-1 truncate">{dbPath()}</div>
                </Show>
                <Show when={isElectronRenderer()}>
                  <button class="btn btn-xs" onClick={handleOpenFolder} title="Open database folder">Open Folder</button>
                </Show>
              </div>
            </div>

            <Show when={isElectronRenderer()}>
              <div class="border-t border-base-300 pt-4">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <div class="font-semibold">Automatic backups</div>
                  <div class="text-xs text-base-content/60">Weekly backups with retention</div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm toggle-primary"
                    checked={config()?.backup.enabled ?? true}
                    onChange={(e) => updateBackupConfig({ enabled: e.currentTarget.checked })}
                    title={(config()?.backup.enabled ?? true) ? 'Disable automatic backups' : 'Enable automatic backups'}
                  />
                  {(config()?.backup.enabled ?? true) ? 'Enabled' : 'Disabled'}
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
                  title="Weekly backup retention"
                />
                <select
                  class="select select-sm select-bordered"
                  value={config()?.backup.format ?? 'db'}
                  onChange={(e) => updateBackupConfig({ format: e.currentTarget.value as ChroniiConfig['backup']['format'] })}
                  title="Automatic backup format"
                >
                  <option value="db">.db</option>
                  <option value="csv">CSV</option>
                  <option value="both">Both</option>
                </select>
                <Show when={isElectronRenderer()}>
                  <button
                    class="btn btn-xs"
                    onClick={handleChooseBackupLocation}
                    title="Choose where automatic backups are stored (manual backups always use the default folder)"
                  >
                    Choose Backup Folder
                  </button>
                </Show>
              </div>
              <Show when={isElectronRenderer()}>
                <div class="text-xs text-base-content/60 mt-1 flex items-center gap-2">
                  <span class="truncate">
                    Location: {config()?.backup.location ?? 'Default (app data backups folder)'}
                  </span>
                  <Show when={config()?.backup.location}>
                    <button
                      class="btn btn-ghost btn-xs"
                      onClick={handleRestoreDefaultLocation}
                      title="restore default"
                    >
                      x
                    </button>
                  </Show>
                </div>
              </Show>
              </div>
            </Show>

            <Show when={!isElectronRenderer()}>
              <div class="border-t border-base-300 pt-4">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <div class="font-semibold">Backup reminders</div>
                    <div class="text-xs text-base-content/60">Weekly reminders to download a backup</div>
                  </div>
                  <label class="cursor-pointer flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      class="toggle toggle-sm toggle-primary"
                      checked={remindersConfig().enabled}
                      onChange={(e) => updateReminderConfig({ enabled: e.currentTarget.checked })}
                      title={remindersConfig().enabled ? 'Disable backup reminders' : 'Enable backup reminders'}
                    />
                    {remindersConfig().enabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <label class="text-sm">Day</label>
                  <select
                    class="select select-sm select-bordered"
                    value={remindersConfig().dayOfWeek}
                    onChange={(e) => updateReminderConfig({ dayOfWeek: Number(e.currentTarget.value) })}
                    title="Choose which day reminders appear"
                  >
                    {reminderDays.map((day, index) => (
                      <option value={index}>{day}</option>
                    ))}
                  </select>
                  <label class="text-sm">Format</label>
                  <select
                    class="select select-sm select-bordered"
                    value={remindersConfig().format}
                    onChange={(e) => updateReminderConfig({ format: e.currentTarget.value as 'db' | 'csv' })}
                    title="Choose the backup format for reminder downloads"
                  >
                    <option value="db">.db</option>
                    <option value="csv">.csv</option>
                  </select>
                </div>
              </div>
            </Show>

            <div class="border-t border-base-300 pt-4">
              <div class="font-semibold mb-2">Actions</div>
              <div class="flex flex-wrap gap-2">
                <Show when={isElectronRenderer()}>
                  <button
                    class="btn btn-sm"
                    onClick={handleManualBackup}
                    disabled={isBusy()}
                    title="Create a .db.bak backup in the default app data backups folder. Current data stays unchanged."
                  >
                    Backup Now
                  </button>
                  <button
                    class="btn btn-sm"
                    onClick={() => {
                      setShowRestoreModal(true);
                      setRestoreError(null);
                    }}
                    disabled={isBusy()}
                    title="Restore from a .db.bak file with options for how to merge with current data"
                  >
                    Restore Backup
                  </button>
                  <button
                    class="btn btn-sm"
                    onClick={handleCleanupBackups}
                    disabled={isBusy()}
                    title="Review and delete .db.bak backups outside your retention rules"
                  >
                    Cleanup Backups
                  </button>
                </Show>
                <Show when={!isElectronRenderer()}>
                  <button
                    class="btn btn-sm"
                    onClick={handleDownloadDb}
                    disabled={isBusy()}
                    title="Download a .db backup of your browser data."
                  >
                    Download DB
                  </button>
                <button
                  class="btn btn-sm"
                  onClick={handleRestoreDb}
                  disabled={isBusy()}
                  title="Restore a .db file with merge and preview options."
                >
                  Restore DB
                </button>
                </Show>
                <button
                  class="btn btn-sm"
                  onClick={handleExportCsv}
                  disabled={isBusy()}
                  title="Export all entries to a CSV file. Current data stays unchanged."
                >
                  Export CSV
                </button>
                <button
                  class="btn btn-sm"
                  onClick={() => {
                    setShowCsvImportModal(true);
                    setCsvImportError(null);
                  }}
                  disabled={isBusy()}
                  title="Import entries from a CSV file with de-duplication and preview options"
                >
                  Import CSV
                </button>
                <button
                  class="btn btn-sm btn-error"
                  onClick={() => setShowClearAllConfirm(true)}
                  disabled={isBusy()}
                  title="Delete all time entries from the current database"
                >
                  Clear all data
                </button>
              </div>
              <Show when={statusMessage()}>
                <div class="text-xs text-base-content/70 mt-2 flex flex-wrap items-center gap-2">
                  <span>{statusMessage()}</span>
                  <Show when={statusActionLabel() && statusActionPath()}>
                    <button
                      class="btn btn-ghost btn-xs"
                      onClick={handleOpenStatusFolder}
                      title="Open the folder for this file"
                    >
                      {statusActionLabel()}
                    </button>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        show={showClearAllConfirm()}
        title="Clear all data?"
        message="This will delete all time entries. This action cannot be undone."
        confirmLabel="Clear all data"
        confirmClass="btn-error"
        onConfirm={() => {
          setShowClearAllConfirm(false);
          handleClearAllData();
        }}
        onCancel={() => setShowClearAllConfirm(false)}
      />
      <Show when={showCsvImportModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[250]">
          <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-xl mx-4">
            <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
              <h3 class="text-lg font-semibold">Import CSV</h3>
              <button class="btn btn-sm btn-ghost" onClick={() => setShowCsvImportModal(false)} title="Close">Close</button>
            </div>
            <div class="p-5 space-y-4">
              <div class="flex items-center gap-3">
                <button
                  class="btn btn-sm"
                  onClick={handleSelectCsvImport}
                  title="Choose a CSV file to import"
                >
                  Choose CSV
                </button>
                <div class="text-sm text-base-content/70 truncate">
                  {csvImportSource()
                    ? (csvImportSource()!.type === 'path' ? csvImportSource()!.value : (csvImportSource()!.name || 'Selected CSV'))
                    : 'No file selected'}
                </div>
              </div>

              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-semibold">Skip duplicates</div>
                  <div class="text-xs text-base-content/60">
                    Exact match on task, times, timestamps, and logged status (1 second tolerance).
                  </div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm toggle-primary"
                    checked={csvImportDedupe()}
                    onChange={(e) => setCsvImportDedupe(e.currentTarget.checked)}
                    title={csvImportDedupe() ? 'Import will skip exact duplicates' : 'Import will include duplicates'}
                  />
                  {csvImportDedupe() ? 'On' : 'Off'}
                </label>
              </div>

              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-semibold">Dry run preview</div>
                  <div class="text-xs text-base-content/60">
                    Preview what will be added or skipped before committing.
                  </div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm toggle-primary"
                    checked={csvImportDryRun()}
                    onChange={(e) => setCsvImportDryRun(e.currentTarget.checked)}
                    title={csvImportDryRun() ? 'Preview changes before import' : 'Import immediately'}
                  />
                  {csvImportDryRun() ? 'On' : 'Off'}
                </label>
              </div>

              <Show when={csvImportError()}>
                <div class="text-xs text-error">{csvImportError()}</div>
              </Show>

              <div class="flex justify-end gap-3">
                <button class="btn btn-sm" onClick={() => setShowCsvImportModal(false)} disabled={isBusy()}>
                  Cancel
                </button>
                <button class="btn btn-sm btn-primary" onClick={handleImportCsvAction} disabled={isBusy()}>
                  {csvImportDryRun() ? 'Preview import' : 'Import CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showRestoreModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[250]">
          <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-xl mx-4">
            <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
              <h3 class="text-lg font-semibold">Restore Backup</h3>
              <button class="btn btn-sm btn-ghost" onClick={() => setShowRestoreModal(false)} title="Close">Close</button>
            </div>
            <div class="p-5 space-y-4">
              <div class="flex items-center gap-3">
                <button
                  class="btn btn-sm"
                  onClick={handleSelectRestoreFile}
                  title={isElectronRenderer() ? 'Choose a .db.bak backup to restore' : 'Choose a .db file to restore'}
                >
                  {isElectronRenderer() ? 'Choose Backup' : 'Choose DB'}
                </button>
                <div class="text-sm text-base-content/70 truncate">
                  {restoreSourcePath() ?? restoreSourceBuffer()?.name ?? 'No file selected'}
                </div>
              </div>

              <div class="space-y-2">
                <div class="font-semibold">Restore mode</div>
                <select
                  class="select select-sm select-bordered w-full"
                  value={restoreMode()}
                  onChange={(e) => setRestoreMode(e.currentTarget.value as RestoreMode)}
                  title="Choose how to apply backup data"
                >
                  <option value="replace">Replace current data with the backup</option>
                  <option value="merge">Merge backup into current data</option>
                  <option value="keep-newer">Restore backup and keep newer current entries</option>
                </select>
              </div>

              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-semibold">Skip duplicates</div>
                  <div class="text-xs text-base-content/60">
                    Exact match on task, times, timestamps, and logged status (1 second tolerance).
                  </div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm toggle-primary"
                    checked={restoreSkipDuplicates()}
                    onChange={(e) => setRestoreSkipDuplicates(e.currentTarget.checked)}
                    disabled={restoreMode() !== 'merge'}
                    title={restoreMode() === 'merge'
                      ? (restoreSkipDuplicates() ? 'Merge will skip exact duplicates' : 'Merge will include duplicates')
                      : 'Only applies to merge mode'}
                  />
                  {restoreSkipDuplicates() ? 'On' : 'Off'}
                </label>
              </div>

              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-semibold">Dry run preview</div>
                  <div class="text-xs text-base-content/60">
                    Preview adds, removals, and skips before restoring.
                  </div>
                </div>
                <label class="cursor-pointer flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="toggle toggle-sm toggle-primary"
                    checked={restoreDryRun()}
                    onChange={(e) => setRestoreDryRun(e.currentTarget.checked)}
                    title={restoreDryRun() ? 'Preview changes before restore' : 'Restore immediately'}
                  />
                  {restoreDryRun() ? 'On' : 'Off'}
                </label>
              </div>

              <Show when={restoreError()}>
                <div class="text-xs text-error">{restoreError()}</div>
              </Show>

              <div class="flex justify-end gap-3">
                <button class="btn btn-sm" onClick={() => setShowRestoreModal(false)} disabled={isBusy()}>
                  Cancel
                </button>
                <button class="btn btn-sm btn-primary" onClick={handleRestoreAction} disabled={isBusy()}>
                  {restoreDryRun() ? 'Preview restore' : 'Restore backup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showCleanupModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[250]">
          <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-xl mx-4">
            <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
              <h3 class="text-lg font-semibold">Cleanup Backups</h3>
              <button class="btn btn-sm btn-ghost" onClick={() => setShowCleanupModal(false)} title="Close">Close</button>
            </div>
            <div class="p-5 space-y-4">
              <Show when={cleanupPreview()}>
                <div class="text-sm text-base-content/70">
                  {cleanupPreview()?.totalFiles ?? 0} files will be deleted, freeing {formatBytes(cleanupPreview()?.totalBytes ?? 0)}.
                </div>
                <div class="max-h-60 overflow-y-auto border border-base-300 rounded-md">
                  <div class="divide-y divide-base-300">
                    <Show when={(cleanupPreview()?.files ?? []).length === 0}>
                      <div class="p-3 text-sm text-base-content/60">No backups to delete.</div>
                    </Show>
                    {(cleanupPreview()?.files ?? []).map((file: any) => (
                      <div class="flex items-center justify-between gap-4 p-3 text-sm">
                        <div class="min-w-0">
                          <div class="font-medium truncate" title={file.path}>{file.name}</div>
                        </div>
                        <div class="text-xs text-base-content/60">{formatBytes(file.size)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Show>

              <Show when={cleanupError()}>
                <div class="text-xs text-error">{cleanupError()}</div>
              </Show>

              <div class="flex justify-end gap-3">
                <button class="btn btn-sm" onClick={() => setShowCleanupModal(false)} disabled={isBusy()}>
                  Cancel
                </button>
                <button class="btn btn-sm btn-error" onClick={confirmCleanupBackups} disabled={isBusy()}>
                  Delete backups
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showPreviewModal()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[260]">
          <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div class="flex items-center justify-between px-5 py-3 border-b border-base-300">
              <h3 class="text-lg font-semibold">Preview changes</h3>
              <button class="btn btn-sm btn-ghost" onClick={() => setShowPreviewModal(false)} title="Close">Close</button>
            </div>
            <div class="p-5 space-y-4">
              <Show when={previewData()}>
                <div class="text-sm text-base-content/70">
                  {`Adds: ${previewData()?.summary?.adds ?? 0} | Removes: ${previewData()?.summary?.removes ?? 0} | Skips: ${previewData()?.summary?.skips ?? 0}`}
                  <Show when={previewData()?.cutoffTime}>
                    {` | Cutoff: ${formatPreviewTime(previewData()!.cutoffTime)}`}
                  </Show>
                </div>

                <div class="flex items-center justify-between text-xs text-base-content/60">
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={isAllSelected()}
                      onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
                    />
                    Select all
                  </label>
                  <div>
                    Selected: {selectedCounts().adds} adds, {selectedCounts().removes} removes
                  </div>
                </div>

                <div class="max-h-72 overflow-y-auto border border-base-300 rounded-md">
                  <div class="divide-y divide-base-300">
                    <Show when={previewItems().length === 0}>
                      <div class="p-3 text-sm text-base-content/60">No changes to apply.</div>
                    </Show>
                    {previewItems().map((item: any, index: number) => (
                      <div class="flex items-center justify-between gap-4 p-3 text-sm">
                        <label class={`flex items-center gap-3 min-w-0 ${item.action === 'skip' ? 'opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm"
                            checked={previewSelections().has(index)}
                            disabled={item.action === 'skip'}
                            onChange={() => togglePreviewSelection(index)}
                          />
                          <div class="min-w-0">
                            <div class="font-medium truncate">{item.entry?.taskName?.trim() ? item.entry.taskName : '(untitled)'}</div>
                            <div class="text-xs text-base-content/60">
                              {formatPreviewTime(item.entry.startTime)}
                            </div>
                          </div>
                        </label>
                        <div
                          class={`badge badge-sm ${
                            item.action === 'add'
                              ? 'badge-success'
                              : item.action === 'remove'
                                ? 'badge-error'
                                : 'badge-ghost'
                          }`}
                          title={getPreviewActionTooltip(item)}
                        >
                          {item.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Show>
              <div class="flex justify-end gap-3">
                <button class="btn btn-sm" onClick={() => setShowPreviewModal(false)} disabled={isBusy()}>
                  Cancel
                </button>
                <button class="btn btn-sm btn-primary" onClick={handlePreviewConfirm} disabled={isBusy()}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
};

export default DatabaseSettings;
