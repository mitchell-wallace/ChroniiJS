import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatTimerDisplay } from '../utils/timeFormatting';
import InlineEdit from './InlineEdit';

interface TimerProps {
  onTimerUpdate?: (isRunning: boolean, activeEntry: TimeEntry | null) => void;
  refreshTrigger?: number;
}

const Timer: Component<TimerProps> = (props) => {
  const [taskName, setTaskName] = createSignal('');
  const [isRunning, setIsRunning] = createSignal(false);
  const [activeEntry, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = createSignal(0);
  const [intervalId, setIntervalId] = createSignal<number | NodeJS.Timeout | null>(null);
  const [recentTasks, setRecentTasks] = createSignal<string[]>([]);

  // Check for active timer and load recent tasks on component mount
  const checkActiveTimer = async () => {
    try {
      const active = await window.timerAPI.getActiveTimer();
      const currentActive = activeEntry();
      
      // If there's a change in active timer state
      if ((!active && currentActive) || (active && (!currentActive || active.id !== currentActive.id))) {
        // Stop current timer updates
        stopElapsedTimeUpdate();
        
        if (active) {
          setActiveEntry(active);
          setTaskName(active.taskName);
          setIsRunning(true);
          startElapsedTimeUpdate(active.startTime);
        } else {
          setActiveEntry(null);
          setTaskName('');
          setIsRunning(false);
          setElapsedTime(0);
        }
      }
      
      // Load recent tasks
      await loadRecentTasks();
    } catch (error) {
      console.error('Error checking for active timer:', error);
    }
  };

  // Check active timer on mount
  createEffect(async () => {
    await checkActiveTimer();
  });

  // Check active timer when refresh is triggered
  createEffect(async () => {
    if (props.refreshTrigger !== undefined) {
      await checkActiveTimer();
    }
  });

  const loadRecentTasks = async () => {
    try {
      const entries = await window.entriesAPI.getAllEntries(10);
      const uniqueTasks = [...new Set(entries.map(entry => entry.taskName))];
      setRecentTasks(uniqueTasks.slice(0, 5)); // Show last 5 unique tasks
    } catch (error) {
      console.error('Error loading recent tasks:', error);
    }
  };

  // Notify parent component of timer updates
  createEffect(() => {
    props.onTimerUpdate?.(isRunning(), activeEntry());
  });

  const startElapsedTimeUpdate = (startTime: number) => {
    const id = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100); // Update every 100ms for smooth display
    
    setIntervalId(id);
  };

  const stopElapsedTimeUpdate = () => {
    const id = intervalId();
    if (id !== null) {
      clearInterval(id);
      setIntervalId(null);
    }
  };

  const handleStart = async () => {
    const name = taskName().trim();
    if (!name) {
      alert('Please enter a task name');
      return;
    }

    try {
      const entry = await window.timerAPI.startTimer(name);
      setActiveEntry(entry);
      setIsRunning(true);
      startElapsedTimeUpdate(entry.startTime);
      await loadRecentTasks(); // Refresh recent tasks
    } catch (error) {
      console.error('Error starting timer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to start timer: ${errorMessage}`);
    }
  };

  const handleStop = async () => {
    const entry = activeEntry();
    if (!entry) return;

    try {
      await window.timerAPI.stopTimer(entry.id);
      setIsRunning(false);
      setActiveEntry(null);
      setElapsedTime(0);
      stopElapsedTimeUpdate();
      await loadRecentTasks(); // Refresh recent tasks
    } catch (error) {
      console.error('Error stopping timer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to stop timer: ${errorMessage}\n\nDetails:\n- Check if database is accessible\n- Timer entry ID: ${entry.id}\n- Try restarting the application`);
    }
  };

  const handleTaskNameUpdate = async (newTaskName: string) => {
    const entry = activeEntry();
    if (!entry || !newTaskName.trim()) return;

    try {
      const updatedEntry = await window.entriesAPI.updateEntry(entry.id, {
        taskName: newTaskName.trim()
      });
      
      if (updatedEntry) {
        setActiveEntry(updatedEntry);
        setTaskName(updatedEntry.taskName);
        await loadRecentTasks(); // Refresh recent tasks
      }
    } catch (error) {
      console.error('Error updating task name:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to update task name: ${errorMessage}`);
    }
  };


  // Cleanup interval on component unmount
  onCleanup(() => {
    stopElapsedTimeUpdate();
  });

  return (
    <div class="px-3 py-1 bg-base-100" data-testid="timer">
      {/* Main Timer Row */}
      <div class="flex items-center gap-3 mb-1">
        {/* Status Indicator */}
        <div 
          class={`w-2 h-2 rounded-full flex-shrink-0 ${isRunning() ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
          data-testid="timer-status-indicator"
        ></div>
        
        {/* Task Input / Running Task Name */}
        {isRunning() ? (
          <div class="flex-1 min-w-0">
            <InlineEdit
              value={taskName()}
              onSave={handleTaskNameUpdate}
              placeholder="Task name"
              class="text-sm text-base-content truncate"
              readOnlyClass="hover:bg-base-200 hover:rounded px-1 -mx-1 py-0.5"
              editClass="input input-sm input-bordered"
              maxLength={200}
              data-testid="timer-running-task-name"
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder="What are you working on?"
            class="input input-sm input-bordered flex-1 min-w-0"
            value={taskName()}
            onInput={(e) => setTaskName(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isRunning()) {
                handleStart();
              }
            }}
            data-testid="timer-task-input"
          />
        )}
        
        {/* Timer Display */}
        <div 
          class="text-xl font-mono font-bold text-primary flex-shrink-0 min-w-[4rem] text-right"
          data-testid="timer-display"
        >
          {formatTimerDisplay(elapsedTime())}
        </div>
        
        {/* Start/Stop Button */}
        {!isRunning() ? (
          <button
            class="btn btn-primary btn-sm flex-shrink-0"
            onClick={handleStart}
            disabled={!taskName().trim()}
            title="Start timer"
            data-testid="timer-start-button"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
          </button>
        ) : (
          <button
            class="btn btn-error btn-sm flex-shrink-0"
            onClick={handleStop}
            title="Stop timer"
            data-testid="timer-stop-button"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Running Task Info */}
      {isRunning() && activeEntry() && (
        <div class="text-xs text-base-content/60 mb-2" data-testid="timer-start-time">
          Started at {new Date(activeEntry()!.startTime).toLocaleTimeString()}
        </div>
      )}

      {/* Quick Start Buttons */}
      <Show when={!isRunning() && recentTasks().length > 0}>
        <div class="border-t border-base-300 pt-2" data-testid="timer-recent-tasks">
          <div class="flex flex-wrap gap-1">
            <For each={recentTasks()}>
              {(task) => (
                <button
                  class="btn btn-xs btn-outline text-xs"
                  onClick={() => {
                    setTaskName(task);
                    handleStart();
                  }}
                  data-testid={`timer-recent-task-${task.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {task.length > 12 ? task.substring(0, 12) + '...' : task}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Timer;