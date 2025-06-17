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
    <div class="card bg-base-200 shadow-lg p-6 mb-6">
      <h2 class="card-title text-2xl mb-4 flex items-center gap-2">
        <div class={`w-3 h-3 rounded-full ${isRunning() ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
        Timer
      </h2>
      
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Task Name</span>
        </label>
        <input
          type="text"
          placeholder="What are you working on?"
          class="input input-bordered w-full"
          value={taskName()}
          onInput={(e) => setTaskName(e.currentTarget.value)}
          disabled={isRunning()}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isRunning()) {
              handleStart();
            }
          }}
        />
      </div>

      <div class="flex items-center justify-between mb-4">
        <div class="text-4xl font-mono font-bold text-primary">
          {formatTime(elapsedTime())}
        </div>
        
        <div class="flex gap-2">
          {!isRunning() ? (
            <button
              class="btn btn-primary btn-lg"
              onClick={handleStart}
              disabled={!taskName().trim()}
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
              Start
            </button>
          ) : (
            <button
              class="btn btn-error btn-lg"
              onClick={handleStop}
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
              </svg>
              Stop
            </button>
          )}
        </div>
      </div>

      {isRunning() && activeEntry() && (
        <div class="text-sm text-base-content/70">
          Started at {new Date(activeEntry()!.startTime).toLocaleTimeString()}
        </div>
      )}

      {/* Quick Start Buttons */}
      <Show when={!isRunning() && recentTasks().length > 0}>
        <div class="mt-4">
          <div class="text-sm text-base-content/70 mb-2">Quick Start:</div>
          <div class="flex flex-wrap gap-2">
            <For each={recentTasks()}>
              {(task) => (
                <button
                  class="btn btn-sm btn-outline"
                  onClick={() => {
                    setTaskName(task);
                    handleStart();
                  }}
                >
                  <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                  </svg>
                  {task}
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