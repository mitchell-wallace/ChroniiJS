import { expect, test } from '@playwright/test';

test('restore modal requires preview for non-replace restores', async ({
	page,
}) => {
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => {
		localStorage.removeItem('chronii-db');
	});
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page
		.getByRole('button', { name: 'Continue in Guest Mode' })
		.click({ timeout: 5000 })
		.catch(() => {});

	await expect(page.getByTestId('database-settings-button')).toBeVisible();
	await page.getByTestId('database-settings-button').click();
	await page.getByTestId('open-restore-modal-button').click();

	const modal = page.getByTestId('restore-modal');
	await expect(modal).toBeVisible();

	const restoreMode = page.getByTestId('restore-mode-select');
	const dryRunToggle = page.getByTestId('restore-dry-run-toggle');
	const submitButton = page.getByTestId('restore-submit-button');

	await restoreMode.selectOption('merge');
	await expect(dryRunToggle).toBeChecked();
	await expect(dryRunToggle).toBeDisabled();
	await expect(submitButton).toHaveText('Preview restore');

	await restoreMode.selectOption('replace');
	await expect(dryRunToggle).toBeEnabled();
});
