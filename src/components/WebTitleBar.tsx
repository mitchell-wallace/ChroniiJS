import { Component, createSignal } from 'solid-js';
import { Show } from 'solid-js';

const WebTitleBar: Component = () => {
  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  
  const handleReset = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('chronii-db');
      }
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  const onResetClick = () => {
    setShowConfirmDialog(true);
  };

  const confirmReset = () => {
    setShowConfirmDialog(false);
    handleReset();
  };

  const cancelReset = () => {
    setShowConfirmDialog(false);
  };

  return (
    <>
      <div class="w-full bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between flex-shrink-0 z-50">
        <div class="flex items-center gap-3">
          <img
            src="/chronii-js-logo-32.png"
            alt="Chronii Logo"
            class="w-6 h-6"
          />
          <span class="text-base font-semibold">Chronii</span>
          <span class="text-xs text-base-content/60 ml-2">Web Edition</span>
        </div>

        <button
          type="button"
          class="text-xs text-error hover:bg-base-300 px-2 py-1 rounded transition-colors cursor-pointer"
          onClick={onResetClick}
          data-testid="web-reset-data"
        >
          Reset data
        </button>
      </div>
      
      {/* Confirmation Dialog */}
      <Show when={showConfirmDialog()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-base-100 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
            <h3 class="text-lg font-bold mb-3">Confirm Reset</h3>
            <p class="mb-6">Are you sure you want to reset all data? This action cannot be undone.</p>
            <div class="flex gap-3 justify-end">
              <button
                type="button"
                class="btn btn-sm"
                onClick={cancelReset}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-sm btn-error"
                onClick={confirmReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
};

export default WebTitleBar;
