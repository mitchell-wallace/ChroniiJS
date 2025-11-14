import { Component } from 'solid-js';

const WebTitleBar: Component = () => {
  return (
    <div class="bg-base-200 border-b border-base-300 px-4 py-2 flex items-center gap-3 flex-shrink-0">
      <img
        src="/chronii-js-logo-32.png"
        alt="Chronii Logo"
        class="w-6 h-6"
      />
      <span class="text-base font-semibold">Chronii</span>
      <span class="text-xs text-base-content/60 ml-2">Web Edition</span>
    </div>
  );
};

export default WebTitleBar;
