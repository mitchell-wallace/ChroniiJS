import { Component, For, createMemo } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDurationSummary } from '../utils/timeFormatting';
import TaskItem from './TaskItem';

interface DailySummaryProps {
  date: string;
  entries: TimeEntry[];
  editingEntry: number | null;
  editValues: {
    taskName: string;
    startTime: string;
    endTime: string;
  };
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: number) => void;
  onStartTimer: (taskName: string) => void;
  onEditValuesChange: (values: { taskName: string; startTime: string; endTime: string }) => void;
  onSave: (entryId: number) => void;
  onCancel: () => void;
  currentTime: number;
  selectedTaskIds: Set<number>;
  onToggleSelection: (id: number) => void;
  onToggleLogged: (id: number) => void;
}

const DailySummary: Component<DailySummaryProps> = (props) => {

  // Compute daily total reactively from entries and currentTime
  const dailyTotal = createMemo(() => {
    return props.entries.reduce((sum, entry) => {
      const end = entry.endTime ?? props.currentTime;
      return sum + (end - entry.startTime);
    }, 0);
  });

  return (
    <div class="bg-base-200/30" data-testid={`daily-summary-${props.date.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* Date header with daily total */}
      <div
        class="sticky top-0 bg-base-200 pl-3 pr-5 py-2 border-b border-base-300/50 flex items-center justify-between text-sm font-medium"
        data-testid={`daily-header-${props.date.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span data-testid={`daily-date-${props.date.toLowerCase().replace(/\s+/g, '-')}`}>
          {props.date}
        </span>
        <span 
          class="text-primary font-mono font-bold"
          data-testid={`daily-duration-${props.date.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {formatDurationSummary(dailyTotal())}
        </span>
      </div>
      
      {/* Entries for this date */}
      <div 
        class="divide-y divide-base-300"
        data-testid={`daily-entries-${props.date.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <For each={props.entries}>
          {(entry) => (
            <TaskItem
              entry={entry}
              isEditing={props.editingEntry === entry.id}
              editValues={props.editValues}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onStartTimer={props.onStartTimer}
              onEditValuesChange={props.onEditValuesChange}
              onSave={props.onSave}
              onCancel={props.onCancel}
              currentTime={props.currentTime}
              isSelected={props.selectedTaskIds.has(entry.id)}
              onToggleSelection={props.onToggleSelection}
              onToggleLogged={props.onToggleLogged}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default DailySummary;