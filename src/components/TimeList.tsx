import { Component, createSignal, createEffect, For, Show, onCleanup, createMemo } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDateTimeForInput, parseInputDateTime } from '../utils/timeFormatting';
import WeeklySummary, { type WeeklyGroup } from './WeeklySummary';
import SelectionSummary from './SelectionSummary';

interface TimeListProps {
  onEntryUpdate?: () => void;
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
    try {
      setLoading(true);
      const allEntries = await window.entriesAPI.getAllEntries(50); // Get last 50 entries
      setEntries(allEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimer = async (taskName: string) => {
    try {
      await window.timerAPI.startTimer(taskName);
      await loadEntries(); // Refresh the list
      props.onEntryUpdate?.(); // Notify parent about the change
    } catch (error) {
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
      console.error('Error updating logged status:', error);
      alert('Failed to update logged status');
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
      console.error('Error updating entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      // Check if the entry being deleted is currently running
      const entryToDelete = entries().find(entry => entry.id === id);
      const isRunningTimer = entryToDelete && !entryToDelete.endTime;
      
      // If it's a running timer, stop it first
      if (isRunningTimer) {
        try {
          await window.timerAPI.stopTimer(id);
        } catch (stopError) {
          console.error('Error stopping timer before deletion:', stopError);
          // Continue with deletion even if stop fails
        }
      }
      
      const success = await window.entriesAPI.deleteEntry(id);
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.(); // This will trigger timer state refresh
      } else {
        alert('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  // Group entries by week and day, calculate totals
  const groupedByWeeks = (): WeeklyGroup[] => {
    const weekGroups: WeeklyGroup[] = [];
    const entriesList = entries();

    // First group by week
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
          totalWeekDuration: 0,
          days: []
        };
        weekGroups.push(weekGroup);
      }

      // Now group by day within the week
      const dateStr = formatDate(entry.startTime);
      let dayGroup = weekGroup.days.find(d => d.date === dateStr);
      
      if (!dayGroup) {
        dayGroup = { date: dateStr, entries: [], totalDuration: 0 };
        weekGroup.days.push(dayGroup);
      }
      
      dayGroup.entries.push(entry);
    });

    // Calculate totals for days and weeks
    weekGroups.forEach(weekGroup => {
      weekGroup.days.forEach(dayGroup => {
        dayGroup.totalDuration = dayGroup.entries.reduce((total, entry) => {
          const endTime = entry.endTime || currentTime();
          return total + (endTime - entry.startTime);
        }, 0);
      });
      
      weekGroup.totalWeekDuration = weekGroup.days.reduce((total, day) => {
        return total + day.totalDuration;
      }, 0);

      // Sort days within week (most recent first)
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
        currentTime={currentTime()}
      />
    </div>
  );
};

export default TimeList;