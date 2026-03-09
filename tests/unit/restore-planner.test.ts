import { describe, expect, it } from 'vitest';
import type { PreviewEntrySnapshot } from '../../src/shared/api-types';
import {
	getDefaultRestoreChanges,
	planRestore,
} from '../../src/shared/restore-planner';

function entry(
	overrides: Partial<PreviewEntrySnapshot> = {},
): PreviewEntrySnapshot {
	return {
		id: 'cdefaultentryid0000001',
		taskName: 'Task',
		startTime: 1_700_000_000_000,
		endTime: 1_700_000_100_000,
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_100_000,
		logged: false,
		...overrides,
	};
}

describe('restore planner', () => {
	it('does not collide unrelated databases when legacy numeric ids were stripped', () => {
		const current = [entry({ id: 'ccurrententryid000001', taskName: 'Current' })];
		const backup = [{ ...entry({ id: undefined, taskName: 'Backup' }) }];

		const preview = planRestore(backup, current, 'merge');

		expect(preview.items).toHaveLength(1);
		expect(preview.items[0].action).toBe('add');
	});

	it('skips exact duplicates across databases even when ids differ', () => {
		const current = [entry({ id: 'ccurrententryid000001' })];
		const backup = [entry({ id: 'cbackupentryid0000001' })];

		const preview = planRestore(backup, current, 'merge');

		expect(preview.items).toHaveLength(1);
		expect(preview.items[0].action).toBe('skip');
	});

	it('keeps merge conflict rollbacks unselected by default', () => {
		const current = [entry({ id: 'csharedentryid000001', taskName: 'Current' })];
		const backup = [entry({ id: 'csharedentryid000001', taskName: 'Backup' })];

		const preview = planRestore(backup, current, 'merge');
		const changes = getDefaultRestoreChanges(preview);

		expect(preview.items[0].action).toBe('rollback');
		expect(preview.items[0].selectedByDefault).toBe(false);
		expect(changes.updates ?? []).toHaveLength(0);
	});

	it('keeps newer current edits in keep-newer mode', () => {
		const current = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Current',
				updatedAt: 1_700_000_200_000,
			}),
		];
		const backup = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Backup',
				updatedAt: 1_700_000_100_000,
			}),
		];

		const preview = planRestore(backup, current, 'keep-newer');
		const changes = getDefaultRestoreChanges(preview);

		expect(preview.items[0].action).toBe('skip');
		expect(changes.updates ?? []).toHaveLength(0);
	});

	it('handles running backup entries without using a global cutoff', () => {
		const current = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Current',
				endTime: 1_700_000_050_000,
				updatedAt: 1_700_000_050_000,
			}),
		];
		const backup = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Running Backup',
				endTime: null,
				updatedAt: 1_700_000_300_000,
			}),
		];

		const preview = planRestore(backup, current, 'keep-newer');
		const changes = getDefaultRestoreChanges(preview);

		expect(preview.items[0].action).toBe('rollback');
		expect(changes.updates ?? []).toHaveLength(1);
		expect(changes.updates?.[0].taskName).toBe('Running Backup');
	});

	it('selects backup-newer conflicts by default in keep-newer mode', () => {
		const current = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Current',
				updatedAt: 1_700_000_100_000,
			}),
		];
		const backup = [
			entry({
				id: 'csharedentryid000001',
				taskName: 'Backup',
				updatedAt: 1_700_000_300_000,
			}),
		];

		const preview = planRestore(backup, current, 'keep-newer');
		const changes = getDefaultRestoreChanges(preview);

		expect(preview.items[0].action).toBe('rollback');
		expect(preview.items[0].selectedByDefault).toBe(true);
		expect(changes.updates ?? []).toHaveLength(1);
	});
});
