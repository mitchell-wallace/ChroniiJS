import { Component, For } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import DailySummary from './DailySummary';

export interface WeeklyGroup {
  weekLabel: string;
  weekStart: Date;
  weekEnd: Date;
  totalWeekDuration: number;
  days: {
    date: string;
    entries: TimeEntry[];
    totalDuration: number;
  }[];
}

interface WeeklySummaryProps {
  week: WeeklyGroup;
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

const WeeklySummary: Component<WeeklySummaryProps> = (props) => {
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
    <div class="bg-base-300/50">
      {/* Week header with weekly total */}
      <div class="sticky top-0 bg-base-300 px-3 py-3 border-b-2 border-base-300 flex items-center justify-between text-base font-semibold">
        <span>{props.week.weekLabel}</span>
        <span class="text-primary font-mono">{formatDurationCompact(props.week.totalWeekDuration)}</span>
      </div>
      
      {/* Days within this week */}
      <div>
        <For each={props.week.days}>
          {(day) => (
            <DailySummary
              date={day.date}
              entries={day.entries}
              totalDuration={day.totalDuration}
              editingEntry={props.editingEntry}
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

export default WeeklySummary;