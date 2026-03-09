# v0.0.3 Address Review Feedback

## Summary
- Restore and import now use stable string ids, shared restore planning, and an atomic replace path for destructive Electron flows.
- Non-replace restores are preview-first in the UI so preview and execution semantics stay aligned.
- Coverage now includes restore-planner unit tests, web restore integration tests, a mocked Electron backup-service safety suite, and an e2e smoke test for restore modal behavior.

## Implemented Changes
### Identity and schema
- `TimeEntry.id` and `PreviewEntrySnapshot.id` are now string-based across shared types, IPC, preload, renderer props, and tests.
- Both SQLite backends migrate legacy numeric `time_entries.id` columns to text ids and preserve timestamps/logged state.
- Imported CSV and DB content accepts legacy numeric ids, but runtime matching only treats CUID-style ids as stable identity.

### Restore planner and semantics
- Added a shared restore planner in [src/shared/restore-planner.ts](/home/mitchell/Documents/Mycode/chroniijs/src/shared/restore-planner.ts).
- Matching now prefers migrated CUID identity and falls back to content fingerprints with 1-second tolerance.
- `merge` adds unmatched rows, skips exact duplicates, and surfaces conflicting same-identity rows as unselected rollback candidates.
- `keep-newer` compares entries per row using `updatedAt`, then `createdAt`, then running-entry time fields.
- Preview and direct execution both consume the same planner defaults in Electron and web restore flows.

### Atomic replace safety
- Electron destructive restore/import now validates into a temp file, creates a rollback backup, swaps files, and reopens the database.
- Validation failures leave the live database untouched.

### Testing
- Added restore-planner coverage for numeric-id collisions, exact duplicates, merge defaults, keep-newer behavior, and running-entry backups.
- Added sql.js migration coverage for legacy numeric-id databases.
- Added web-backend restore coverage for invalid replace input, preview/apply parity, and legacy CSV id migration.
- Added mocked Electron backup-service tests for atomic import/restore and rollback backup creation.
- Added a Playwright smoke test that enforces preview-only behavior for non-replace restores in the database settings modal.

## Follow-up Notes
- Native `better-sqlite3` test runs still depend on a clean local install matching the active Node ABI.
- The repo currently has unrelated lockfile churn (`package-lock.json`, `pnpm-lock.yaml`) that is intentionally not part of this spec implementation.
