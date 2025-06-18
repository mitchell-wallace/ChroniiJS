import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import TimeList from './components/TimeList';
import Summary from './components/Summary';
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
      <div class="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-primary mb-2">ChroniiJS</h1>
          <p class="text-base-content/70">Simple Time Tracking</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Timer and Status */}
          <div class="space-y-6">
            {/* Timer Section */}
            <Timer onTimerUpdate={handleTimerUpdate} />

            {/* Status Display */}
            <div class="card bg-base-200 shadow-lg p-6">
              <h2 class="card-title text-xl mb-4">Status</h2>
              
              <div class="grid grid-cols-1 gap-4">
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
                <p>✅ History View</p>
                <p>✅ Quick Start Buttons</p>
                <p>✅ Inline Editing</p>
              </div>
            </div>

            {/* Summary Section */}
            <Summary refreshTrigger={refreshTrigger()} />
          </div>

          {/* Right Column - Time List */}
          <div>
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