import { test, expect } from '@playwright/test';

// Basic e2e to ensure the web app at / can start a timer and does not throw
// the previous undefined API/sql.js errors.
test('user can start a timer on the base route', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');

  // Introspect the injected web backend APIs
  const apiInfo = await page.evaluate(() => {
    const w = window as any;
    return {
      hasTimerAPI: !!w.timerAPI,
      hasEntriesAPI: !!w.entriesAPI,
      hasWindowAPI: !!w.windowAPI,
      hasViewAPI: !!w.viewAPI,
      timerAPIKeys: w.timerAPI ? Object.keys(w.timerAPI) : [],
    };
  });
  console.log('Web backend API info:', JSON.stringify(apiInfo));

  // Fill task name
  const taskInput = page.getByTestId('timer-task-input');
  await taskInput.fill('Playwright E2E Task');

  // Click start button
  const startButton = page.getByTestId('timer-start-button');
  await startButton.click();

  // Give the app a moment to process and surface any console errors
  await page.waitForTimeout(300);

  // Check active timer via the injected API
  const activeTimer = await page.evaluate(async () => {
    const w = window as any;
    if (!w.timerAPI || !w.timerAPI.getActiveTimer) return null;
    return await w.timerAPI.getActiveTimer();
  });
  console.log('Active timer after clicking start:', JSON.stringify(activeTimer));

  // Timer display should show a non-zero elapsed time after a short wait
  const display = page.getByTestId('timer-display');
  const initialText = await display.textContent();
  await page.waitForTimeout(1100);
  const laterText = await display.textContent();

  expect(initialText).not.toBeNull();
  expect(laterText).not.toBeNull();
  expect(laterText).not.toEqual(initialText);

  // A history list should be present
  await expect(page.getByTestId('time-list')).toBeVisible();

  // Log any console errors to aid debugging if this test fails
  // (they will also be checked against known-bad patterns below)
  if (errors.length > 0) {
    console.log('Playwright captured console errors:\n' + errors.join('\n'));
  }

  // Ensure no console errors mentioning the previous failure signatures
  const joined = errors.join('\n');
  expect(joined).not.toMatch(/startTimer/);
  expect(joined).not.toMatch(/getActiveTimer/);
  expect(joined).not.toMatch(/getAllEntries/);
  expect(joined).not.toMatch(/isMaximized/);
  expect(joined).not.toMatch(/sql-wasm/);
});

// Verify that a timer can be started and then stopped, and that an entry
// appears in the history list.
test('user can stop a timer and see it in history', async ({ page }) => {
  await page.goto('/');

  // Ensure a clean slate for the test
  await page.getByTestId('web-reset-data').click();

  await page.goto('/');

  const taskName = 'Playwright Stop Task';
  const taskInput = page.getByTestId('timer-task-input');
  await taskInput.fill(taskName);

  const startButton = page.getByTestId('timer-start-button');
  await startButton.click();

  // Wait briefly, then stop the timer
  await page.waitForTimeout(500);

  const stopButton = page.getByTestId('timer-stop-button');
  await stopButton.click();

  // History list should now contain our task name somewhere
  const timeList = page.getByTestId('time-list');
  await expect(timeList).toContainText(taskName);
});
