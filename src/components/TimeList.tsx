import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';

interface TimeListProps {
  onEntryUpdate?: () => void;
}

const TimeList: Component<TimeListProps> = (props) => {
  const [entries, setEntries] = createSignal<TimeEntry[]>([]);
  const [loading, setLoading] = createSignal(true);

  // Load time entries on component mount
  createEffect(async () => {
    await loadEntries();
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

  // Group entries by date
  const groupedEntries = () => {
    const groups: { date: string, entries: TimeEntry[] }[] = [];
    const entriesList = entries();

    entriesList.forEach(entry => {
      const dateStr = formatDate(entry.startTime);
      let group = groups.find(g => g.date === dateStr);
      
      if (!group) {
        group = { date: dateStr, entries: [] };
        groups.push(group);
      }
      
      group.entries.push(entry);
    });

    return groups;
  };

  return (
    <div class="card bg-base-200 shadow-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="card-title text-xl">Time Entries</h2>
        <button 
          class="btn btn-sm btn-ghost"
          onClick={loadEntries}
          disabled={loading()}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
          <span class="ml-2">Loading entries...</span>
        </div>
      </Show>

      <Show when={!loading() && entries().length === 0}>
        <div class="text-center py-8 text-base-content/60">
          <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No time entries yet</p>
          <p class="text-sm">Start a timer to create your first entry</p>
        </div>
      </Show>

      <Show when={!loading() && entries().length > 0}>
        <div class="space-y-4 max-h-96 overflow-y-auto">
          <For each={groupedEntries()}>
            {(group) => (
              <div>
                <div class="text-sm font-semibold text-base-content/70 mb-2 sticky top-0 bg-base-200 py-1">
                  {group.date}
                </div>
                
                <div class="space-y-2">
                  <For each={group.entries}>
                    {(entry) => (
                      <div class="bg-base-100 rounded-lg p-4 border border-base-300">
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <div class="font-medium text-base-content">
                              {entry.taskName}
                            </div>
                            <div class="text-sm text-base-content/60 mt-1">
                              {formatTime(entry.startTime)} - {entry.endTime ? formatTime(entry.endTime) : 'Running'}
                            </div>
                          </div>
                          
                          <div class="flex items-center gap-3">
                            <div class="text-lg font-mono font-semibold text-primary">
                              {formatDuration(entry.startTime, entry.endTime)}
                            </div>
                            
                            <div class="flex gap-1">
                              <button 
                                class="btn btn-ghost btn-xs"
                                title="Edit entry"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              
                              <button 
                                class="btn btn-ghost btn-xs text-error"
                                onClick={() => deleteEntry(entry.id)}
                                title="Delete entry"
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <Show when={!entry.endTime}>
                          <div class="mt-2">
                            <span class="badge badge-success badge-sm">
                              <div class="w-2 h-2 bg-white rounded-full animate-pulse mr-1"></div>
                              Currently Running
                            </span>
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