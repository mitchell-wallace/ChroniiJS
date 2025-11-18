import { Component, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDuration } from '../utils/timeFormatting';

interface SelectionSummaryProps {
  selectedEntries: TimeEntry[];
  onDeselectAll: () => void;
  onMarkDone?: () => void;
  currentTime: number;
}

const SelectionSummary: Component<SelectionSummaryProps> = (props) => {
  const calculateTotalDuration = (): number => {
    return props.selectedEntries.reduce((total, entry) => {
      const endTime = entry.endTime || props.currentTime;
      return total + (endTime - entry.startTime);
    }, 0);
  };

  return (
    <Show when={props.selectedEntries.length > 0}>
      <div
        class="sticky bottom-0 bg-base-200 border-t border-base-300 px-3 py-2 flex items-center justify-between"
        data-testid="selection-summary"
      >
        <div class="flex items-center gap-3">
          <span class="text-sm text-base-content/70">
            {props.selectedEntries.length} task{props.selectedEntries.length === 1 ? '' : 's'}
          </span>
          <span
            class="text-sm font-mono font-bold text-primary"
            data-testid="selection-total-duration"
          >
            Total: {formatDuration(calculateTotalDuration())}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm"
            onClick={props.onMarkDone}
            title="Mark all selected tasks as done"
            data-testid="mark-done-button"
          >
            Mark done
            <svg class="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>

          <button
            class="btn btn-ghost btn-sm btn-square cursor-pointer"
            onClick={props.onDeselectAll}
            title="Deselect All"
            data-testid="deselect-all-button"
          >
            <svg class="w-4 h-4 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Show>
  );
};

export default SelectionSummary;