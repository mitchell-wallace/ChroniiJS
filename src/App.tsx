import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import TimeList from './components/TimeList';
import TitleBar from './components/TitleBar';
import type { TimeEntry } from './types/electron';

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
      {/* Sticky Header Section */}
      <div class="sticky top-0 z-50 bg-base-100">
        {/* Custom Title Bar */}
        <TitleBar />
        
        {/* Compact Timer Section */}
        <div class="container mx-auto px-0 max-w-4xl">
          <Timer 
            onTimerUpdate={handleTimerUpdate} 
            refreshTrigger={timerRefreshTrigger()}
          />
          
          {/* Timer/TimeList divider */}
          <hr class="border-base-300" />
        </div>
      </div>
      
      {/* Scrollable Content Area */}
      <div class="flex-1 min-h-0 overflow-hidden">
        <div class="container mx-auto px-0 max-w-4xl h-full">
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
  );
};

export default App;