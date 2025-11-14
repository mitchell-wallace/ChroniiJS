import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
  ],
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        // Serve the unified entry at the base route
        main: './index.html',
      },
    },
  },
  optimizeDeps: {
    // Avoid pre-bundling sql.js so its wasm loader works correctly in the browser
    exclude: ['sql.js'],
  },
})
