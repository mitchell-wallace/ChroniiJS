import { Component, Show, createMemo } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDuration } from '../utils/timeFormatting';

interface SelectionSummaryProps {
  selectedEntries: TimeEntry[];
  onDeselectAll: () => void;
  onToggleSelectedLogged: () => void;
  onDeleteSelected: () => void;
  currentTime: number;
}

const SelectionSummary: Component<SelectionSummaryProps> = (props) => {
  const calculateTotalDuration = (): number => {
    return props.selectedEntries.reduce((total, entry) => {
      const endTime = entry.endTime || props.currentTime;
      return total + (endTime - entry.startTime);
    }, 0);
  };

  // Check if all selected entries are already logged
  const allSelectedLogged = createMemo(() => {
    return props.selectedEntries.length > 0 && 
           props.selectedEntries.every(entry => entry.logged);
  });

  return (
    <Show when={props.selectedEntries.length > 0}>
      <div 
        class="sticky bottom-0 bg-base-200 border-t border-base-300 px-3 py-2 flex items-center justify-between"
        data-testid="selection-summary"
      >
        <div class="flex items-center gap-3">
          <span 
            class="text-sm font-mono font-bold text-primary"
            data-testid="selection-total-duration"
          >
            Total: {formatDuration(calculateTotalDuration())}
          </span>
        </div>

        <span class="text-sm text-base-content/50" data-testid="selection-count">
          {props.selectedEntries.length} task{props.selectedEntries.length === 1 ? '' : 's'}
        </span>
        
        <div class="flex items-center gap-1">
          <button
            class={`btn btn-ghost btn-xs ${allSelectedLogged() ? 'text-gray-500/50' : 'text-gray-500'}`}
            onClick={props.onToggleSelectedLogged}
            title={allSelectedLogged() ? 'Mark selected as not logged' : 'Mark selected as logged'}
            data-testid="toggle-selected-logged-button"
          >
            {/* Double-tick icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
              <path fill="currentColor" d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
            </svg>
          </button>

          <button
            class="btn btn-ghost btn-xs text-error"
            onClick={props.onDeleteSelected}
            title="Delete selected"
            data-testid="delete-selected-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <button
            class="btn btn-ghost btn-xs opacity-50"
            onClick={props.onDeselectAll}
            title="Deselect all"
            data-testid="deselect-all-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </Show>
  );
};

export default SelectionSummary;