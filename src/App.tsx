import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import TimeList from './components/TimeList';
import TitleBar from './components/TitleBar';
import type { TimeEntry } from './types/electron';
import { isElectronRenderer } from './env';

const App: Component = () => {
  const [, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [, setIsTimerRunning] = createSignal(false);
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [timerRefreshTrigger, setTimerRefreshTrigger] = createSignal(0);

  const handleTimerUpdate = (isRunning: boolean, entry: TimeEntry | null) => {
    setIsTimerRunning(isRunning);
    setActiveEntry(entry);
    // Trigger TimeList refresh when timer state changes
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div class="h-screen bg-base-100 flex flex-col">
      {/* Custom Title Bar (Electron only) */}
      {isElectronRenderer() && <TitleBar />}
      
      <div class="container mx-auto px-0 max-w-4xl flex flex-col flex-1">
        {/* Flexible Layout */}
        <div class="flex flex-col flex-1 min-h-0">
          {/* Compact Timer Section */}
          <div class="flex-shrink-0">
            <Timer 
              onTimerUpdate={handleTimerUpdate} 
              refreshTrigger={timerRefreshTrigger()}
            />
          </div>
          
          {/* Timer/TimeList divider */}
          <hr class="border-base-300 flex-shrink-0" />

          {/* History with Integrated Summary */}
          <div class="flex-1 min-h-0">
            <TimeList 
              refreshTrigger={refreshTrigger()}
              onEntryUpdate={() => {
                // Refresh timer state when entries are updated (e.g., play button, delete)
                setTimerRefreshTrigger(prev => prev + 1);
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;