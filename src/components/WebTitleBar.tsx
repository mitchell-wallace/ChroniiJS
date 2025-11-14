import { Component } from 'solid-js';

const WebTitleBar: Component = () => {
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

  return (
    <div class="w-full bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between flex-shrink-0">
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
        class="btn btn-xs btn-ghost text-xs text-base-content/70"
        onClick={handleReset}
        data-testid="web-reset-data"
      >
        Reset data
      </button>
    </div>
  );
};

export default WebTitleBar;
