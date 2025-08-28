import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { TimeEntry } from '../types/electron';

interface TimerProps {
  onTimerUpdate?: (isRunning: boolean, activeEntry: TimeEntry | null) => void;
}

const Timer: Component<TimerProps> = (props) => {
  const [taskName, setTaskName] = createSignal('');
  const [isRunning, setIsRunning] = createSignal(false);
  const [activeEntry, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = createSignal(0);
  const [intervalId, setIntervalId] = createSignal<number | null>(null);
  const [recentTasks, setRecentTasks] = createSignal<string[]>([]);

  // Check for active timer and load recent tasks on component mount
  createEffect(async () => {
    try {
      const active = await window.timerAPI.getActiveTimer();
      if (active) {
        setActiveEntry(active);
        setTaskName(active.taskName);
        setIsRunning(true);
        startElapsedTimeUpdate(active.startTime);
      }
      
      // Load recent tasks
      await loadRecentTasks();
    } catch (error) {
      console.error('Error checking for active timer:', error);
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
      alert('Failed to start timer');
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
      alert('Failed to stop timer');
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Cleanup interval on component unmount
  onCleanup(() => {
    stopElapsedTimeUpdate();
  });

  return (
    <div class="px-3 py-1">
      {/* Main Timer Row */}
      <div class="flex items-center gap-3 mb-1">
        {/* Status Indicator */}
        <div class={`w-2 h-2 rounded-full flex-shrink-0 ${isRunning() ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
        
        {/* Task Input / Running Task Name */}
        {isRunning() ? (
          <div class="flex-1 min-w-0 text-sm text-base-content truncate">
            {taskName()}
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
          />
        )}
        
        {/* Timer Display */}
        <div class="text-xl font-mono font-bold text-primary flex-shrink-0 min-w-[4rem] text-right">
          {formatTime(elapsedTime())}
        </div>
        
        {/* Start/Stop Button */}
        {!isRunning() ? (
          <button
            class="btn btn-primary btn-sm flex-shrink-0"
            onClick={handleStart}
            disabled={!taskName().trim()}
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
            </svg>
          </button>
        ) : (
          <button
            class="btn btn-error btn-sm flex-shrink-0"
            onClick={handleStop}
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Running Task Info */}
      {isRunning() && activeEntry() && (
        <div class="text-xs text-base-content/60 mb-2">
          Started at {new Date(activeEntry()!.startTime).toLocaleTimeString()}
        </div>
      )}

      {/* Quick Start Buttons */}
      <Show when={!isRunning() && recentTasks().length > 0}>
        <div class="border-t border-base-300 pt-2">
          <div class="flex flex-wrap gap-1">
            <For each={recentTasks()}>
              {(task) => (
                <button
                  class="btn btn-xs btn-outline text-xs"
                  onClick={() => {
                    setTaskName(task);
                    handleStart();
                  }}
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