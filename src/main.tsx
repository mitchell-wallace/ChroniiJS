/* @refresh reload */
import { render } from 'solid-js/web';
import './style.css';
import App from './App';
import WebWrapper from './components/WebWrapper';
import { initializeWebBackend } from './database/web-backend';
import { isElectronRenderer } from './env';

const root = document.getElementById('app');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

if (isElectronRenderer()) {
  // Electron renderer: use the existing App layout with Electron title bar
  render(() => <App />, root!);
} else {
  // Pure web: initialize the sql.js-backed web backend first, then render
  initializeWebBackend().then(() => {
    render(() => (
      <WebWrapper>
        <App />
      </WebWrapper>
    ), root!);
  }).catch((error) => {
    console.error('Failed to initialize web backend:', error);
    // Render error message
    render(() => (
      <div class="flex items-center justify-center h-screen">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-error mb-4">Initialization Error</h1>
          <p class="text-base-content/70">Failed to initialize the database. Please refresh the page.</p>
          <pre class="mt-4 text-xs text-left bg-base-200 p-4 rounded">{String(error)}</pre>
        </div>
      </div>
    ), root!);
  });
}
