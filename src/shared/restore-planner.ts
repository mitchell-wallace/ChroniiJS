import type {
	ApplyChangesPayload,
	PreviewEntrySnapshot,
	PreviewItem,
	PreviewResult,
	RestoreMode,
} from './api-types';
import {
	compareEntryRecency,
	createEntryFingerprint,
	getStableEntryId,
} from './entry-identity';

type IndexedEntry = {
	index: number;
	entry: PreviewEntrySnapshot;
};

function getFingerprintMatches(
	buckets: Map<string, IndexedEntry[]>,
	fingerprint: string,
	matchedCurrent: Set<number>,
): IndexedEntry | undefined {
	const entries = buckets.get(fingerprint);
	return entries?.find((candidate) => !matchedCurrent.has(candidate.index));
}

function createRollbackEntry(
	current: PreviewEntrySnapshot,
	incoming: PreviewEntrySnapshot,
): PreviewEntrySnapshot {
	return {
		id: current.id,
		taskName: incoming.taskName,
		startTime: incoming.startTime,
		endTime: incoming.endTime,
		createdAt: incoming.createdAt,
		updatedAt: incoming.updatedAt,
		logged: incoming.logged,
	};
}

function createSkipItem(
	entry: PreviewEntrySnapshot,
	incomingEntry: PreviewEntrySnapshot,
	currentEntry: PreviewEntrySnapshot,
): PreviewItem {
	return {
		action: 'skip',
		entry,
		source: 'backup',
		incomingEntry,
		currentEntry,
		selectedByDefault: false,
	};
}

export function planRestore(
	backupEntries: PreviewEntrySnapshot[],
	currentEntries: PreviewEntrySnapshot[],
	mode: RestoreMode,
): PreviewResult {
	const effectiveMode = mode === 'dedupe' ? 'merge' : mode;
	const currentIndexed = currentEntries.map((entry, index) => ({
		entry,
		index,
	}));
	const currentById = new Map<string, IndexedEntry>();
	const currentByFingerprint = new Map<string, IndexedEntry[]>();

	for (const indexed of currentIndexed) {
		const stableId = getStableEntryId(indexed.entry);
		if (stableId) {
			currentById.set(stableId, indexed);
		}

		const fingerprint = createEntryFingerprint(indexed.entry);
		const bucket = currentByFingerprint.get(fingerprint) ?? [];
		bucket.push(indexed);
		currentByFingerprint.set(fingerprint, bucket);
	}

	const matchedCurrent = new Set<number>();
	const items: PreviewItem[] = [];

	for (const backupEntry of backupEntries) {
		const stableId = getStableEntryId(backupEntry);
		const idMatch = stableId ? currentById.get(stableId) : undefined;
		const fingerprint = createEntryFingerprint(backupEntry);
		const fingerprintMatch = getFingerprintMatches(
			currentByFingerprint,
			fingerprint,
			matchedCurrent,
		);

		if (
			fingerprintMatch &&
			(!idMatch || idMatch.index === fingerprintMatch.index)
		) {
			matchedCurrent.add(fingerprintMatch.index);
			items.push(
				createSkipItem(
					fingerprintMatch.entry,
					backupEntry,
					fingerprintMatch.entry,
				),
			);
			continue;
		}

		if (idMatch) {
			matchedCurrent.add(idMatch.index);
			if (effectiveMode === 'merge') {
				items.push({
					action: 'rollback',
					entry: createRollbackEntry(idMatch.entry, backupEntry),
					source: 'backup',
					incomingEntry: backupEntry,
					currentEntry: idMatch.entry,
					selectedByDefault: false,
				});
				continue;
			}

			if (effectiveMode === 'keep-newer') {
				const recency = compareEntryRecency(backupEntry, idMatch.entry);
				if (recency > 0) {
					items.push({
						action: 'rollback',
						entry: createRollbackEntry(idMatch.entry, backupEntry),
						source: 'backup',
						incomingEntry: backupEntry,
						currentEntry: idMatch.entry,
						selectedByDefault: true,
					});
				} else {
					items.push(createSkipItem(idMatch.entry, backupEntry, idMatch.entry));
				}
				continue;
			}

			items.push({
				action: 'rollback',
				entry: createRollbackEntry(idMatch.entry, backupEntry),
				source: 'backup',
				incomingEntry: backupEntry,
				currentEntry: idMatch.entry,
				selectedByDefault: true,
			});
			continue;
		}

		items.push({
			action: 'add',
			entry: backupEntry,
			source: 'backup',
			incomingEntry: backupEntry,
			selectedByDefault: true,
		});
	}

	if (effectiveMode === 'replace') {
		for (const current of currentIndexed) {
			if (matchedCurrent.has(current.index)) continue;
			items.push({
				action: 'remove',
				entry: current.entry,
				source: 'current',
				currentEntry: current.entry,
				selectedByDefault: true,
			});
		}
	}

	const summary = {
		adds: items.filter((item) => item.action === 'add').length,
		removes: items.filter((item) => item.action === 'remove').length,
		rollbacks: items.filter((item) => item.action === 'rollback').length,
		skips: items.filter((item) => item.action === 'skip').length,
		total: items.length,
	};

	return {
		summary,
		items,
		mode: effectiveMode,
	};
}

export function getDefaultRestoreChanges(
	result: PreviewResult,
): ApplyChangesPayload {
	const adds: PreviewEntrySnapshot[] = [];
	const removes: PreviewEntrySnapshot[] = [];
	const updates: PreviewEntrySnapshot[] = [];

	for (const item of result.items) {
		if (!item.selectedByDefault) continue;
		if (item.action === 'add') {
			adds.push(item.entry);
			continue;
		}
		if (item.action === 'remove') {
			removes.push(item.entry);
			continue;
		}
		if (item.action === 'rollback') {
			updates.push(item.entry);
		}
	}

	return { adds, removes, updates };
}
