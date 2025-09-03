import { Component, Show, createSignal } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatTime, formatDuration } from '../utils/timeFormatting';
import ContextMenu from './ContextMenu';

interface TaskItemProps {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: number) => void;
  onStartTimer: (taskName: string) => void;
  isEditing: boolean;
  editValues: {
    taskName: string;
    startTime: string;
    endTime: string;
  };
  onEditValuesChange: (values: { taskName: string; startTime: string; endTime: string }) => void;
  onSave: (entryId: number) => void;
  onCancel: () => void;
  currentTime: number;
}

const TaskItem: Component<TaskItemProps> = (props) => {
  const [showContextMenu, setShowContextMenu] = createSignal(false);
  const [contextMenuPosition, setContextMenuPosition] = createSignal({ x: 0, y: 0 });

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleDoubleClick = () => {
    if (!props.isEditing) {
      props.onEdit(props.entry);
    }
  };

  const contextMenuItems = [
    {
      label: 'Continue',
      icon: 'M5 3l14 9-14 9V3z',
      onClick: () => props.onStartTimer(props.entry.taskName)
    },
    {
      label: 'Edit',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      onClick: () => props.onEdit(props.entry)
    },
    {
      label: 'Delete',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      onClick: () => props.onDelete(props.entry.id),
      danger: true
    }
  ];

  return (
    <>
      <div 
        class="px-2 py-2 bg-base-100" 
        onContextMenu={handleContextMenu}
        onDblClick={handleDoubleClick}
        data-testid={`task-item-${props.entry.id}`}
      >
        <Show when={props.isEditing} fallback={
          <div class="flex items-center gap-1 min-h-[2rem]" data-testid={`task-item-${props.entry.id}-display`}>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate" data-testid={`task-item-${props.entry.id}-name`}>
                {props.entry.taskName}
              </div>
              <div class="text-xs text-base-content/60" data-testid={`task-item-${props.entry.id}-time-range`}>
                {formatTime(props.entry.startTime)} - {props.entry.endTime ? formatTime(props.entry.endTime) : 'Running'}
              </div>
            </div>
            
            <div 
              class="text-sm font-mono font-semibold text-primary flex-shrink-0 min-w-[3rem] text-right"
              data-testid={`task-item-${props.entry.id}-duration`}
            >
              {formatDuration(props.entry.endTime ? props.entry.endTime - props.entry.startTime : props.currentTime - props.entry.startTime)}
            </div>
            
            <div class="flex gap-0 flex-shrink-0" data-testid={`task-item-${props.entry.id}-actions`}>
              <button 
                class="btn btn-ghost btn-sm p-1 h-8 w-8 min-h-0"
                onClick={() => props.onStartTimer(props.entry.taskName)}
                title="Start timer with this task"
                data-testid={`task-item-${props.entry.id}-play-button`}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />
                </svg>
              </button>
              
              <button 
                class="btn btn-ghost btn-sm p-1 h-8 w-8 min-h-0"
                onClick={() => props.onEdit(props.entry)}
                title="Edit entry"
                data-testid={`task-item-${props.entry.id}-edit-button`}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            
            {!props.entry.endTime && (
              <div 
                class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"
                data-testid={`task-item-${props.entry.id}-running-indicator`}
              ></div>
            )}
          </div>
        }>
        <div class="space-y-2 py-1" data-testid={`task-item-${props.entry.id}-edit-form`}>
          <input
            type="text"
            class="input input-xs input-bordered w-full"
            value={props.editValues.taskName}
            onInput={(e) => props.onEditValuesChange({
              ...props.editValues,
              taskName: e.currentTarget.value
            })}
            placeholder="Task name"
            data-testid={`task-item-${props.entry.id}-edit-name`}
          />
          
          <div class="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              step="1"
              class="input input-xs input-bordered text-xs"
              value={props.editValues.startTime}
              onInput={(e) => props.onEditValuesChange({
                ...props.editValues,
                startTime: e.currentTarget.value
              })}
              data-testid={`task-item-${props.entry.id}-edit-start-time`}
            />
            
            <input
              type="datetime-local"
              step="1"
              class="input input-xs input-bordered text-xs"
              value={props.editValues.endTime}
              onInput={(e) => props.onEditValuesChange({
                ...props.editValues,
                endTime: e.currentTarget.value
              })}
              placeholder="End time (optional)"
              data-testid={`task-item-${props.entry.id}-edit-end-time`}
            />
          </div>
          
          <div class="flex justify-between" data-testid={`task-item-${props.entry.id}-edit-actions`}>
            <button 
              class="btn btn-xs btn-error"
              onClick={() => {
                if (confirm('Are you sure you want to delete this time entry?')) {
                  props.onDelete(props.entry.id);
                }
              }}
              title="Delete entry"
              data-testid={`task-item-${props.entry.id}-delete-button`}
            >
              Delete
            </button>
            
            <div class="flex gap-1">
              <button 
                class="btn btn-xs btn-ghost"
                onClick={props.onCancel}
                data-testid={`task-item-${props.entry.id}-cancel-button`}
              >
                Cancel
              </button>
              <button 
                class="btn btn-xs btn-primary"
                onClick={() => props.onSave(props.entry.id)}
                disabled={!props.editValues.taskName.trim() || !props.editValues.startTime}
                data-testid={`task-item-${props.entry.id}-save-button`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
    
    <ContextMenu
      show={showContextMenu()}
      x={contextMenuPosition().x}
      y={contextMenuPosition().y}
      items={contextMenuItems}
      onClose={() => setShowContextMenu(false)}
    />
  </>
  );
};

export default TaskItem;