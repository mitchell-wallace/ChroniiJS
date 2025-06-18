import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import TimeList from './components/TimeList';
import type { TimeEntry } from './types/electron';

const App: Component = () => {
  const [activeEntry, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [isTimerRunning, setIsTimerRunning] = createSignal(false);
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);

  const handleTimerUpdate = (isRunning: boolean, entry: TimeEntry | null) => {
    setIsTimerRunning(isRunning);
    setActiveEntry(entry);
    // Trigger TimeList refresh when timer state changes
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div class="min-h-screen bg-base-100">
      <div class="container mx-auto px-3 py-4 max-w-4xl">
        {/* Compact Header */}
        <div class="text-center mb-4">
          <h1 class="text-2xl font-bold text-primary mb-1">ChroniiJS</h1>
          <p class="text-sm text-base-content/60">Time Tracking</p>
        </div>

        {/* Single Column Layout */}
        <div class="space-y-4">
          {/* Compact Timer Section */}
          <Timer onTimerUpdate={handleTimerUpdate} />

          {/* History with Integrated Summary */}
          <TimeList 
            refreshTrigger={refreshTrigger()}
            onEntryUpdate={() => {
              // Optional: refresh timer state when entries are updated
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default App;