import { Component, createSignal } from 'solid-js';
import Timer from './components/Timer';
import TimeList from './components/TimeList';
import TitleBar from './components/TitleBar';
import type { TimeEntry } from './types/electron';
import { isElectronRenderer } from './env';
import { getDatabaseErrorInfo, type DatabaseErrorInfo } from './utils/databaseErrors';

const App: Component = () => {
  const [, setActiveEntry] = createSignal<TimeEntry | null>(null);
  const [, setIsTimerRunning] = createSignal(false);
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);
  const [timerRefreshTrigger, setTimerRefreshTrigger] = createSignal(0);
  const [dbError, setDbError] = createSignal<DatabaseErrorInfo | null>(null);

  const handleTimerUpdate = (isRunning: boolean, entry: TimeEntry | null) => {
    setIsTimerRunning(isRunning);
    setActiveEntry(entry);
    // Trigger TimeList refresh when timer state changes
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDatabaseError = (error: unknown) => {
    const info = getDatabaseErrorInfo(error);
    if (!info) return;
    setDbError(info);
  };

  return (
    <div class="h-screen bg-base-100 flex flex-col">
      {/* Sticky Header Section */}
      <div class="sticky top-0 z-50 bg-base-100 flex-shrink-0">
        {/* Custom Title Bar (Electron only) */}
        {isElectronRenderer() && <TitleBar />}

        {dbError() && (
          <div class="alert alert-warning rounded-none" role="alert">
            <div class="flex flex-col gap-0.5">
              <div class="font-semibold">{dbError()!.message}</div>
              {dbError()!.details && (
                <div class="text-xs text-base-content/70">{dbError()!.details}</div>
              )}
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => setDbError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        
        {/* Compact Timer Section */}
        <div class="container mx-auto px-0 max-w-4xl">
          <Timer 
            onTimerUpdate={handleTimerUpdate} 
            onDatabaseError={handleDatabaseError}
            refreshTrigger={timerRefreshTrigger()}
          />
          
          {/* Timer/TimeList divider */}
          <hr class="border-base-300" />
        </div>
      </div>
      
      {/* Scrollable Content Area */}
      <div class="flex-1 min-h-0">
        <div class="container mx-auto px-0 max-w-4xl h-full">
          <TimeList 
            refreshTrigger={refreshTrigger()}
            onDatabaseError={handleDatabaseError}
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
