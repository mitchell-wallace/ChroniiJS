import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import type { TimeEntry } from './types/electron';

const App: Component = () => {
  const [activeEntry, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [isTimerRunning, setIsTimerRunning] = createSignal(false);

  const handleTimerUpdate = (isRunning: boolean, entry: TimeEntry | null) => {
    setIsTimerRunning(isRunning);
    setActiveEntry(entry);
  };

  return (
    <div class="min-h-screen bg-base-100">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-primary mb-2">ChroniiJS</h1>
          <p class="text-base-content/70">Simple Time Tracking</p>
        </div>

        {/* Timer Section */}
        <Timer onTimerUpdate={handleTimerUpdate} />

        {/* Status Display */}
        <div class="card bg-base-200 shadow-lg p-6">
          <h2 class="card-title text-xl mb-4">Status</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="stat">
              <div class="stat-title">Timer Status</div>
              <div class={`stat-value text-lg ${isTimerRunning() ? 'text-success' : 'text-base-content/50'}`}>
                {isTimerRunning() ? 'Running' : 'Stopped'}
              </div>
            </div>
            
            <div class="stat">
              <div class="stat-title">Current Task</div>
              <div class="stat-value text-lg">
                {activeEntry()?.taskName || 'No active task'}
              </div>
            </div>
          </div>

          <div class="divider"></div>
          
          <div class="text-sm text-base-content/70 space-y-1">
            <p>✅ Database Integration</p>
            <p>✅ Timer Functionality</p>
            <p>✅ IPC Communication</p>
            <p>⏳ History View (Next Phase)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;