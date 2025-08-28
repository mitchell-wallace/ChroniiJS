import { Component, For } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import TaskItem from './TaskItem';

interface DailySummaryProps {
  date: string;
  entries: TimeEntry[];
  totalDuration: number;
  editingEntry: number | null;
  editValues: {
    taskName: string;
    startTime: string;
    endTime: string;
  };
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: number) => void;
  onEditValuesChange: (values: { taskName: string; startTime: string; endTime: string }) => void;
  onSave: (entryId: number) => void;
  onCancel: () => void;
}

const DailySummary: Component<DailySummaryProps> = (props) => {
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
    <div class="bg-base-200/30">
      {/* Date header with daily total */}
      <div class="sticky top-0 bg-base-200 px-2 py-2 border-b border-base-300/50 flex items-center justify-between text-sm font-medium">
        <span>{props.date}</span>
        <span class="text-primary font-mono">{formatDurationCompact(props.totalDuration)}</span>
      </div>
      
      {/* Entries for this date */}
      <div class="divide-y divide-base-300">
        <For each={props.entries}>
          {(entry) => (
            <TaskItem
              entry={entry}
              isEditing={props.editingEntry === entry.id}
              editValues={props.editValues}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onEditValuesChange={props.onEditValuesChange}
              onSave={props.onSave}
              onCancel={props.onCancel}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default DailySummary;