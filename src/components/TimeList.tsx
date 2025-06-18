import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';

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

  const formatDuration = (startTime: number, endTime: number | null): string => {
    const duration = endTime ? endTime - startTime : Date.now() - startTime;
    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
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

  // Group entries by date and calculate daily totals
  const groupedEntries = () => {
    const groups: { date: string, entries: TimeEntry[], totalDuration: number }[] = [];
    const entriesList = entries();

    entriesList.forEach(entry => {
      const dateStr = formatDate(entry.startTime);
      let group = groups.find(g => g.date === dateStr);
      
      if (!group) {
        group = { date: dateStr, entries: [], totalDuration: 0 };
        groups.push(group);
      }
      
      group.entries.push(entry);
    });

    // Calculate totals for each group
    groups.forEach(group => {
      group.totalDuration = group.entries.reduce((total, entry) => {
        const endTime = entry.endTime || Date.now();
        return total + (endTime - entry.startTime);
      }, 0);
    });

    return groups;
  };

  const formatDurationCompact = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div class="bg-base-200 rounded-lg border border-base-300">
      {/* Header with overall summary */}
      <div class="p-3 border-b border-base-300">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Time Entries</h2>
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
        <div class="max-h-[60vh] overflow-y-auto">
          <For each={groupedEntries()}>
            {(group) => (
              <div>
                {/* Date header with daily total */}
                <div class="sticky top-0 bg-base-300 px-3 py-2 border-b border-base-300 flex items-center justify-between text-sm font-medium">
                  <span>{group.date}</span>
                  <span class="text-primary font-mono">{formatDurationCompact(group.totalDuration)}</span>
                </div>
                
                {/* Entries for this date */}
                <div class="divide-y divide-base-300">
                  <For each={group.entries}>
                    {(entry) => (
                      <div class="px-3 py-2 hover:bg-base-100/50">
                        <Show when={editingEntry() === entry.id} fallback={
                          <div class="flex items-center gap-3 min-h-[2rem]">
                            {/* Task name and time range */}
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-sm truncate">
                                {entry.taskName}
                              </div>
                              <div class="text-xs text-base-content/60">
                                {formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : 'Running'}
                              </div>
                            </div>
                            
                            {/* Duration */}
                            <div class="text-sm font-mono font-semibold text-primary flex-shrink-0 min-w-[3rem] text-right">
                              {formatDurationCompact(entry.endTime ? entry.endTime - entry.startTime : Date.now() - entry.startTime)}
                            </div>
                            
                            {/* Action buttons */}
                            <div class="flex gap-1 flex-shrink-0">
                              <button 
                                class="btn btn-ghost btn-xs p-1 h-6 w-6 min-h-0"
                                onClick={() => startEditing(entry)}
                                title="Edit entry"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              
                              <button 
                                class="btn btn-ghost btn-xs p-1 h-6 w-6 min-h-0 text-error"
                                onClick={() => deleteEntry(entry.id)}
                                title="Delete entry"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* Running indicator */}
                            {!entry.endTime && (
                              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                            )}
                          </div>
                        }>
                          {/* Compact Edit Mode */}
                          <div class="space-y-2 py-1">
                            <input
                              type="text"
                              class="input input-xs input-bordered w-full"
                              value={editValues().taskName}
                              onInput={(e) => setEditValues(prev => ({...prev, taskName: e.currentTarget.value}))}
                              placeholder="Task name"
                            />
                            
                            <div class="grid grid-cols-2 gap-2">
                              <input
                                type="datetime-local"
                                class="input input-xs input-bordered text-xs"
                                value={editValues().startTime}
                                onInput={(e) => setEditValues(prev => ({...prev, startTime: e.currentTarget.value}))}
                              />
                              
                              <input
                                type="datetime-local"
                                class="input input-xs input-bordered text-xs"
                                value={editValues().endTime}
                                onInput={(e) => setEditValues(prev => ({...prev, endTime: e.currentTarget.value}))}
                                placeholder="End time (optional)"
                              />
                            </div>
                            
                            <div class="flex justify-end gap-1">
                              <button 
                                class="btn btn-xs btn-ghost"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </button>
                              <button 
                                class="btn btn-xs btn-primary"
                                onClick={() => saveEntry(entry.id)}
                                disabled={!editValues().taskName.trim() || !editValues().startTime}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default TimeList;