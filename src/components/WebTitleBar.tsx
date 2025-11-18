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

        <div class="flex items-center gap-3">
          {/* Social Links */}
          <div class="flex items-center gap-2 mr-2">
            <a
              href="https://github.com/mitchell-wallace/ChroniiJS"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-content/60 hover:text-base-content transition-colors cursor-pointer"
              title="GitHub"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://twitter.com/chroniijs"
              target="_blank"
              rel="noopener noreferrer"
              class="text-base-content/60 hover:text-base-content transition-colors cursor-pointer"
              title="Twitter"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
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
