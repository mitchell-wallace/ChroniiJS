import { test, expect } from '@playwright/test';

const seedEntries = async (page: any, count: number) => {
  await page.evaluate(async (entryCount) => {
    const w = window as any;
    const baseTime = Date.now();

    for (let i = 0; i < entryCount; i += 1) {
      const name = `Playwright Scroll Task ${String(i + 1).padStart(2, '0')}`;
      const entry = await w.timerAPI.startTimer(name);
      await w.timerAPI.stopTimer(entry.id);

      const startTime = baseTime - i * 60 * 1000;
      const endTime = startTime + 30 * 1000;
      await w.entriesAPI.updateEntry(entry.id, { startTime, endTime, logged: false });
    }
  }, count);
};

const expectVisibleInContainer = async (item: any, container: any) => {
  await expect(item).toBeVisible();

  const containerHandle = await container.elementHandle();
  expect(containerHandle).not.toBeNull();
  if (!containerHandle) return;

  const isInView = await item.evaluate((el: Element, containerEl: Element) => {
    const containerRect = containerEl.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
  }, containerHandle);

  expect(isInView).toBe(true);
};

test('marking logged keeps scroll position in the time list', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 480, height: 520 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('chronii-db');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => (window as any).entriesAPI && (window as any).timerAPI);
  await seedEntries(page, 15);
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });

  const timeList = page.getByTestId('time-list-content');
  await expect(timeList).toBeVisible();

  const orderedEntries = await page.evaluate(async () => {
    const w = window as any;
    const entries = await w.entriesAPI.getAllEntries(50);
    return entries.map((entry: any) => ({ id: entry.id, name: entry.taskName }));
  });

  const firstEntry = orderedEntries[0];
  const lastEntry = orderedEntries[orderedEntries.length - 1];

  const firstName = page.getByTestId(`task-item-${firstEntry.id}-name`);
  await expectVisibleInContainer(firstName, timeList);

  await page.getByTestId(`task-item-${firstEntry.id}-logged-button`).click();
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const w = window as any;
        return (await w.entriesAPI.getEntryById(id))?.logged ?? null;
      }, firstEntry.id)
    )
    .toBe(true);
  await expectVisibleInContainer(firstName, timeList);

  await timeList.evaluate((el: Element) => {
    el.scrollTop = el.scrollHeight;
  });

  const lastName = page.getByTestId(`task-item-${lastEntry.id}-name`);
  await expectVisibleInContainer(lastName, timeList);

  await page.getByTestId(`task-item-${lastEntry.id}-logged-button`).click();
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const w = window as any;
        return (await w.entriesAPI.getEntryById(id))?.logged ?? null;
      }, lastEntry.id)
    )
    .toBe(true);
  await expectVisibleInContainer(lastName, timeList);
});
