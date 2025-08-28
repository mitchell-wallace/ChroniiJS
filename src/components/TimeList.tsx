import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import WeeklySummary, { type WeeklyGroup } from './WeeklySummary';

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
  const [, setLiveUpdateTrigger] = createSignal(0);

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

  // Live update running timers every minute
  createEffect(() => {
    const hasRunningTimers = entries().some(entry => !entry.endTime);
    
    if (hasRunningTimers) {
      const interval = setInterval(() => {
        setLiveUpdateTrigger(prev => prev + 1);
      }, 60000); // Update every minute
      
      return () => clearInterval(interval);
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

  const formatDateTimeForInput = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 16); // Returns YYYY-MM-DDTHH:mm format
  };

  const parseInputDateTime = (dateTimeString: string): number => {
    return new Date(dateTimeString).getTime();
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
      
      // Validate that start time is before end time
      if (updates.endTime && updates.startTime && updates.endTime <= updates.startTime) {
        alert('End time must be after start time');
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
      const success = await window.entriesAPI.deleteEntry(id);
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.();
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
          const endTime = entry.endTime || Date.now();
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
    <div class="bg-base-100">
      {/* Header with overall summary */}
      <div class="p-2 border-b border-base-300">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold">History</div>
          {entries().length > 0 && (
            <div class="text-sm text-base-content/70">
              {entries().length} entries
            </div>
          )}
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center py-6">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span class="text-sm">Loading...</span>
        </div>
      </Show>

      <Show when={!loading() && entries().length === 0}>
        <div class="text-center py-8 text-base-content/50">
          <div class="text-sm">No time entries yet</div>
          <div class="text-xs mt-1">Start a timer to create your first entry</div>
        </div>
      </Show>

      <Show when={!loading() && entries().length > 0}>
        <div class="h-full overflow-y-auto">
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
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default TimeList;