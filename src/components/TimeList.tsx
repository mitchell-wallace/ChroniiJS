import { Component, createSignal, createEffect, For, Show, onCleanup, createMemo, untrack } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDateTimeForInput, parseInputDateTime } from '../utils/timeFormatting';
import WeeklySummary, { type WeeklyGroup } from './WeeklySummary';
import SelectionSummary from './SelectionSummary';
import ConfirmDialog from './ConfirmDialog';

interface TimeListProps {
  onEntryUpdate?: () => void;
  onDatabaseError?: (error: unknown) => void;
  refreshTrigger?: number;
}

const TimeList: Component<TimeListProps> = (props) => {
  const [entries, setEntries] = createSignal<TimeEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [editingEntry, setEditingEntry] = createSignal<number | null>(null);
  const [editValues, setEditValues] = createSignal<{
    taskName: string;
    startTime: string;
    endTime: string;
  }>({ taskName: '', startTime: '', endTime: '' });
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const [selectedTaskIds, setSelectedTaskIds] = createSignal<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteConfirmData, setDeleteConfirmData] = createSignal<{
    count: number;
    items: string[];
    itemsMore: number;
    entryIds: number[];
  }>({ count: 0, items: [], itemsMore: 0, entryIds: [] });
  let liveUpdateInterval: number | null = null;

  // Load time entries on component mount
  createEffect(async () => {
    await loadEntries();
  });

  // Reload entries when refresh trigger changes
  createEffect(async () => {
    if (props.refreshTrigger !== undefined) {
      await loadEntries();
    }
  });

  // Live update current time every second for running timers
  createEffect(() => {
    const hasRunningTimers = entries().some(entry => !entry.endTime);
    
    // Clear existing interval
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    
    if (hasRunningTimers) {
      liveUpdateInterval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000) as unknown as number; // Update every second for seconds precision
    }
  });

  // Cleanup interval on component unmount
  onCleanup(() => {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
    }
  });

  const loadEntries = async () => {
    const shouldShowLoading = untrack(() => entries().length === 0);
    try {
      if (shouldShowLoading) {
        setLoading(true);
      }
      const allEntries = await window.entriesAPI.getAllEntries(50); // Get last 50 entries
      setEntries(allEntries);
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error loading entries:', error);
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  };

  const handleStartTimer = async (taskName: string) => {
    try {
      await window.timerAPI.startTimer(taskName);
      await loadEntries(); // Refresh the list
      props.onEntryUpdate?.(); // Notify parent about the change
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error starting timer:', error);
      alert('Failed to start timer');
    }
  };

  // Selection handlers
  const handleToggleSelection = (entryId: number) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds(new Set<number>());
  };

  // Get selected entries for summary
  const selectedEntries = createMemo(() => {
    const selected = selectedTaskIds();
    return entries().filter(entry => selected.has(entry.id));
  });

  // Handle logged status toggle
  const handleToggleLogged = async (entryId: number) => {
    try {
      const entry = entries().find(e => e.id === entryId);
      if (!entry) return;
      
      const success = await window.entriesAPI.updateEntry(entryId, { logged: !entry.logged });
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.();
      } else {
        alert('Failed to update logged status');
      }
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error updating logged status:', error);
      alert('Failed to update logged status');
    }
  };

  // Handle toggling logged status for all selected entries
  const handleToggleSelectedLogged = async () => {
    const selected = selectedEntries();
    if (selected.length === 0) return;
    
    try {
      // Check if all selected entries are already logged
      const allLogged = selected.every(entry => entry.logged);
      // Toggle: if all logged, mark as not logged; otherwise mark as logged
      const newLoggedState = !allLogged;
      
      await Promise.all(
        selected.map(entry => 
          window.entriesAPI.updateEntry(entry.id, { logged: newLoggedState })
        )
      );
      await loadEntries();
      props.onEntryUpdate?.();
      // Clear selection after toggling
      handleDeselectAll();
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error updating logged status:', error);
      alert('Failed to update logged status');
    }
  };

  // Handle deleting all selected entries - show confirmation dialog
  const handleDeleteSelected = () => {
    const selected = selectedEntries();
    if (selected.length === 0) return;

    // Build confirmation data with task names
    const maxNamesToShow = 5;
    const maxNameLength = 50;
    
    const truncateName = (name: string) => 
      name.length > maxNameLength ? name.substring(0, maxNameLength - 3) + '...' : name;
    
    const taskNames = selected.slice(0, maxNamesToShow).map(e => truncateName(e.taskName));
    const remaining = selected.length - maxNamesToShow;
    
    setDeleteConfirmData({
      count: selected.length,
      items: taskNames,
      itemsMore: remaining > 0 ? remaining : 0,
      entryIds: selected.map(e => e.id)
    });
    setShowDeleteConfirm(true);
  };

  // Execute deletion after confirmation (works for both single and multi-delete)
  const executeDelete = async () => {
    const { entryIds } = deleteConfirmData();
    setShowDeleteConfirm(false);
    
    if (entryIds.length === 0) return;

    try {
      // Get the entries to check for running timers
      const entriesToDelete = entries().filter(e => entryIds.includes(e.id));
      
      // Stop any running timers first, then delete all
      await Promise.all(
        entriesToDelete.map(async (entry) => {
          if (!entry.endTime) {
            try {
              await window.timerAPI.stopTimer(entry.id);
            } catch (e) {
              // Continue even if stop fails
            }
          }
          return window.entriesAPI.deleteEntry(entry.id);
        })
      );
      await loadEntries();
      props.onEntryUpdate?.();
      handleDeselectAll();
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error deleting entries:', error);
      alert('Failed to delete entries');
    }
  };


  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      // For other days, show full weekday and date
      return date.toLocaleDateString([], { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Get the start of the week (Sunday) for a given date
  const getWeekStart = (date: Date): Date => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Sunday = 0
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Get the end of the week (Saturday) for a given date
  const getWeekEnd = (date: Date): Date => {
    const end = new Date(date);
    end.setDate(end.getDate() - end.getDay() + 6); // Saturday
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // Format week label ("this week", "last week", or date range)
  const formatWeekLabel = (weekStart: Date, weekEnd: Date): string => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    if (weekStart.getTime() === thisWeekStart.getTime()) {
      return 'This week';
    } else if (weekStart.getTime() === lastWeekStart.getTime()) {
      return 'Last week';
    } else {
      // Format as "Aug 10 - Aug 16" or "Aug 25 - Sep 1" for cross-month
      const startStr = weekStart.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric'
      });
      const endStr = weekEnd.toLocaleDateString([], {
        month: weekStart.getMonth() === weekEnd.getMonth() ? undefined : 'short',
        day: 'numeric'
      });
      return `${startStr} - ${endStr}`;
    }
  };


  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    setEditValues({
      taskName: entry.taskName,
      startTime: formatDateTimeForInput(entry.startTime),
      endTime: entry.endTime ? formatDateTimeForInput(entry.endTime) : ''
    });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditValues({ taskName: '', startTime: '', endTime: '' });
  };

  const saveEntry = async (entryId: number) => {
    const values = editValues();
    
    try {
      const updates: any = {};
      
      if (values.taskName.trim()) {
        updates.taskName = values.taskName.trim();
      }
      
      if (values.startTime) {
        updates.startTime = parseInputDateTime(values.startTime);
      }
      
      if (values.endTime) {
        updates.endTime = parseInputDateTime(values.endTime);
      } else {
        // If endTime is cleared, set it to null (for active timers)
        updates.endTime = null;
      }
      
      // Validate that end time is not before start time (same time is allowed)
      if (updates.endTime && updates.startTime && updates.endTime < updates.startTime) {
        alert('End time cannot be before start time');
        return;
      }
      
      const success = await window.entriesAPI.updateEntry(entryId, updates);
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.();
        cancelEditing();
      } else {
        alert('Failed to update entry');
      }
    } catch (error) {
      props.onDatabaseError?.(error);
      console.error('Error updating entry:', error);
      alert('Failed to update entry');
    }
  };

  // Show delete confirmation dialog for a single entry
  const deleteEntry = (id: number) => {
    const entryToDelete = entries().find(entry => entry.id === id);
    if (!entryToDelete) return;

    const maxNameLength = 50;
    const truncateName = (name: string) => 
      name.length > maxNameLength ? name.substring(0, maxNameLength - 3) + '...' : name;

    setDeleteConfirmData({
      count: 1,
      items: [truncateName(entryToDelete.taskName)],
      itemsMore: 0,
      entryIds: [id]
    });
    setShowDeleteConfirm(true);
  };

  // Group entries by week and day, calculate totals
  const groupedByWeeks = (): WeeklyGroup[] => {
    const weekGroups: WeeklyGroup[] = [];
    const entriesList = entries();

    // First group by week (purely structural, independent of currentTime)
    entriesList.forEach(entry => {
      const entryDate = new Date(entry.startTime);
      const weekStart = getWeekStart(entryDate);
      const weekEnd = getWeekEnd(entryDate);
      const weekKey = weekStart.toDateString();
      
      let weekGroup = weekGroups.find(w => w.weekStart.toDateString() === weekKey);
      
      if (!weekGroup) {
        weekGroup = {
          weekLabel: formatWeekLabel(weekStart, weekEnd),
          weekStart,
          weekEnd,
          days: []
        };
        weekGroups.push(weekGroup);
      }

      // Now group by day within the week
      const dateStr = formatDate(entry.startTime);
      let dayGroup = weekGroup.days.find(d => d.date === dateStr);
      
      if (!dayGroup) {
        dayGroup = { date: dateStr, entries: [] };
        weekGroup.days.push(dayGroup);
      }
      
      dayGroup.entries.push(entry);
    });

    // Sort days within week (most recent first)
    weekGroups.forEach(weekGroup => {
      weekGroup.days.sort((a, b) => {
        if (a.date === 'Today') return -1;
        if (b.date === 'Today') return 1;
        if (a.date === 'Yesterday') return -1;
        if (b.date === 'Yesterday') return 1;
        return new Date(b.entries[0]?.startTime || 0).getTime() - new Date(a.entries[0]?.startTime || 0).getTime();
      });
    });

    // Sort weeks (most recent first)
    weekGroups.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

    return weekGroups;
  };


  return (
    <div class="h-full flex flex-col bg-base-100" data-testid="time-list">
      {/* Header with overall summary */}
      <div class="p-2 border-b border-base-300 flex-shrink-0" data-testid="time-list-header">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold">History</div>
          {entries().length > 0 && (
            <div class="text-sm text-base-content/70" data-testid="time-list-entry-count">
              {entries().length} entries
            </div>
          )}
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center py-6" data-testid="time-list-loading">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span class="text-sm">Loading...</span>
        </div>
      </Show>

      <Show when={!loading() && entries().length === 0}>
        <div class="text-center py-8 text-base-content/50" data-testid="time-list-empty">
          <div class="text-sm">No time entries yet</div>
          <div class="text-xs mt-1">Start a timer to create your first entry</div>
        </div>
      </Show>

      <Show when={!loading() && entries().length > 0}>
        <div class="flex-1 overflow-y-auto min-h-0" data-testid="time-list-content">
          <For each={groupedByWeeks()}>
            {(week) => (
              <WeeklySummary
                week={week}
                editingEntry={editingEntry()}
                editValues={editValues()}
                onEdit={startEditing}
                onDelete={deleteEntry}
                onStartTimer={handleStartTimer}
                onEditValuesChange={setEditValues}
                onSave={saveEntry}
                onCancel={cancelEditing}
                currentTime={currentTime()}
                selectedTaskIds={selectedTaskIds()}
                onToggleSelection={handleToggleSelection}
                onToggleLogged={handleToggleLogged}
              />
            )}
          </For>
        </div>
      </Show>

      <SelectionSummary
        selectedEntries={selectedEntries()}
        onDeselectAll={handleDeselectAll}
        onToggleSelectedLogged={handleToggleSelectedLogged}
        onDeleteSelected={handleDeleteSelected}
        currentTime={currentTime()}
      />

      <ConfirmDialog
        show={showDeleteConfirm()}
        title={deleteConfirmData().count === 1 
          ? `Delete "${deleteConfirmData().items[0]}"?` 
          : `Delete ${deleteConfirmData().count} tasks?`}
        message="This action cannot be undone."
        items={deleteConfirmData().count > 1 ? deleteConfirmData().items : undefined}
        itemsMore={deleteConfirmData().itemsMore}
        confirmLabel="Delete"
        confirmClass="btn-error"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default TimeList;
