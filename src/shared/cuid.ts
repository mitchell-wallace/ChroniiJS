let cuidCounter = 0;

function randomBlock(length: number): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let value = '';
	for (let index = 0; index < length; index += 1) {
		value += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return value;
}

export function createCuid(): string {
	cuidCounter = (cuidCounter + 1) % 1679616;
	const timestamp = Date.now().toString(36);
	const counter = cuidCounter.toString(36).padStart(4, '0');
	return `c${timestamp}${counter}${randomBlock(12)}`;
}

export function isCuid(value: string | null | undefined): value is string {
	return typeof value === 'string' && /^c[a-z0-9]{18,}$/i.test(value);
}

export function normalizeImportedEntryId(
	value: string | number | null | undefined,
): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return isCuid(trimmed) ? trimmed : undefined;
	}
	return undefined;
}
