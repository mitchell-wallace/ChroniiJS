import { describe, expect, it } from 'vitest';
import { __test__ } from '../../src/database/web-backend';

describe('CSV duplicate detection', () => {
	it('matches exported/imported entries despite millisecond loss', () => {
		const entry = {
			taskName: 'Round Trip Task',
			startTime: 1710000000123,
			endTime: 1710000000456,
			createdAt: 1710000000789,
			updatedAt: 1710000000999,
			logged: false,
		};

		const csv = __test__.entriesToCsv([entry as any]);
		const parsed = __test__.parseCsvEntries(csv);

		expect(parsed).toHaveLength(1);
		const originalKey = __test__.getEntryKey(entry as any);
		const parsedKey = __test__.getEntryKey(parsed[0] as any);

		expect(parsedKey).toBe(originalKey);
	});

	it('treats rounded-down times within 1 second as duplicates', () => {
		const entry = {
			taskName: 'Tolerance Task',
			startTime: 1710000000901,
			endTime: 1710000001901,
			createdAt: 1710000002901,
			updatedAt: 1710000003901,
			logged: true,
		};

		const csv = __test__.entriesToCsv([entry as any]);
		const parsed = __test__.parseCsvEntries(csv);

		expect(parsed).toHaveLength(1);
		expect(__test__.getEntryKey(parsed[0] as any)).toBe(
			__test__.getEntryKey(entry as any),
		);
	});
});
