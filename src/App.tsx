import { Component, createSignal } from 'solid-js';

const App: Component = () => {
  const [count, setCount] = createSignal(0);

  return (
    <div class="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-primary mb-4">ChroniiJS</h1>
        <p class="text-base-content/70 mb-8">Time Tracking Application</p>
        
        <div class="card bg-base-200 shadow-lg p-6">
          <h2 class="card-title text-2xl mb-4">SolidJS + Tailwind + Electron</h2>
          <p class="mb-4">Framework integration test</p>
          
          <div class="flex items-center gap-4 justify-center">
            <button 
              class="btn btn-primary" 
              onClick={() => setCount(count() + 1)}
            >
              Count: {count()}
            </button>
            <button 
              class="btn btn-secondary" 
              onClick={() => setCount(0)}
            >
              Reset
            </button>
          </div>
        </div>
        
        <div class="mt-8 text-sm text-base-content/50">
          <p>✅ SolidJS Framework</p>
          <p>✅ Tailwind CSS + DaisyUI</p>
          <p>✅ Electron Integration</p>
        </div>
      </div>
    </div>
  );
};

export default App;