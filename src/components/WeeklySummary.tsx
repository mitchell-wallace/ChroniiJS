import { Component, For } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDurationSummary } from '../utils/timeFormatting';
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
  onStartTimer: (taskName: string) => void;
  onEditValuesChange: (values: { taskName: string; startTime: string; endTime: string }) => void;
  onSave: (entryId: number) => void;
  onCancel: () => void;
  currentTime: number;
}

const WeeklySummary: Component<WeeklySummaryProps> = (props) => {

  return (
    <div class="bg-base-300/50" data-testid={`weekly-summary-${props.week.weekLabel.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* Week header with weekly total */}
      <div 
        class="sticky top-0 bg-base-300 px-3 py-3 border-b-2 border-base-300 flex items-center justify-between text-base font-semibold"
        data-testid={`weekly-header-${props.week.weekLabel.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span data-testid={`weekly-label-${props.week.weekLabel.toLowerCase().replace(/\s+/g, '-')}`}>
          {props.week.weekLabel}
        </span>
        <span 
          class="text-primary font-mono font-bold"
          data-testid={`weekly-duration-${props.week.weekLabel.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {formatDurationSummary(props.week.totalWeekDuration)}
        </span>
      </div>
      
      {/* Days within this week */}
      <div data-testid={`weekly-days-${props.week.weekLabel.toLowerCase().replace(/\s+/g, '-')}`}>
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
              onStartTimer={props.onStartTimer}
              onEditValuesChange={props.onEditValuesChange}
              onSave={props.onSave}
              onCancel={props.onCancel}
              currentTime={props.currentTime}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default WeeklySummary;