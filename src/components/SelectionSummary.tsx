import { Component, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDuration } from '../utils/timeFormatting';

interface SelectionSummaryProps {
  selectedEntries: TimeEntry[];
  onDeselectAll: () => void;
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
            {props.selectedEntries.length} task{props.selectedEntries.length === 1 ? '' : 's'} selected
          </span>
          <span 
            class="text-sm font-mono font-bold text-primary"
            data-testid="selection-total-duration"
          >
            Total: {formatDuration(calculateTotalDuration())}
          </span>
        </div>
        
        <button
          class="btn btn-ghost btn-xs"
          onClick={props.onDeselectAll}
          data-testid="deselect-all-button"
        >
          Deselect All
        </button>
      </div>
    </Show>
  );
};

export default SelectionSummary;