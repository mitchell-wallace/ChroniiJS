import type { PreviewEntrySnapshot } from './api-types';
import { isCuid } from './cuid';

export type EntryLike = Pick<
	PreviewEntrySnapshot,
	'id' | 'taskName' | 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'logged'
>;

export function normalizeTimeToSecond(value: number | null): number | null {
	if (value === null) return null;
	return Math.floor(value / 1000);
}

export function getStableEntryId(entry: Pick<EntryLike, 'id'>): string | null {
	return isCuid(entry.id) ? entry.id : null;
}

export function createEntryFingerprint(entry: EntryLike): string {
	return JSON.stringify([
		entry.taskName,
		normalizeTimeToSecond(entry.startTime),
		normalizeTimeToSecond(entry.endTime),
		normalizeTimeToSecond(entry.createdAt),
		normalizeTimeToSecond(entry.updatedAt),
		entry.logged ? 1 : 0,
	]);
}

export function compareEntryRecency(a: EntryLike, b: EntryLike): number {
	if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
	if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;

	const aRelevant = a.endTime ?? a.startTime;
	const bRelevant = b.endTime ?? b.startTime;
	if (aRelevant !== bRelevant) return aRelevant - bRelevant;
	if (a.startTime !== b.startTime) return a.startTime - b.startTime;

	const aEnd = a.endTime ?? -1;
	const bEnd = b.endTime ?? -1;
	return aEnd - bEnd;
}
