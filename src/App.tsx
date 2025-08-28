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
    <div class="h-screen bg-base-100 flex flex-col">
      <div class="container mx-auto px-0 max-w-4xl flex flex-col h-full">
        {/* Compact Header */}
        <div class="text-center mb-1 flex-shrink-0">
          <h1 class="text-xl font-bold text-primary">ChroniiJS</h1>
        </div>

        {/* Flexible Layout */}
        <div class="flex flex-col gap-2 flex-1 min-h-0">
          {/* Compact Timer Section */}
          <div class="flex-shrink-0">
            <Timer onTimerUpdate={handleTimerUpdate} />
          </div>

          {/* History with Integrated Summary */}
          <div class="flex-1 min-h-0">
            <TimeList 
              refreshTrigger={refreshTrigger()}
              onEntryUpdate={() => {
                // Optional: refresh timer state when entries are updated
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;