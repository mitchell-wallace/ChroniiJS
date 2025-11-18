import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:5173/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev:web',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
