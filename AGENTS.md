# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChroniiJS is a time tracking application built with SolidJS, Tailwind CSS, and DaisyUI. It runs as both an Electron desktop app and a web application. The project provides a Clockify-like experience focused on offline-first time tracking.

## Essential Commands

### Development
- `pnpm run dev` - Start Electron desktop app in development mode
- `pnpm run dev:web` - Start web version in development mode
- `pnpm run check` - Type check with TypeScript (no emit)
- `pnpm run rebuild` - Rebuild better-sqlite3 for Electron (default, same as rebuild:electron)
- `pnpm run rebuild:electron` - Explicitly rebuild for Electron's bundled Node.js 22.20.0
- `pnpm run rebuild:node` - Rebuild for system Node.js 22.20.0 (used by tests)
- `pnpm postinstall` - Auto-rebuilds native dependencies for Electron (runs after pnpm install)

### Building
- `pnpm run build` - Full Electron production build (TypeScript → Vite → electron-builder)
- `pnpm run build:web` - Build web version only
- `pnpm run build:win` - Build Windows installer only
- `pnpm run build:mac` - Build macOS installer only
- `pnpm run build:linux` - Build Linux installer only
- `pnpm run preview` - Preview Electron build
- `pnpm run preview:web` - Preview web build

### Testing
- `pnpm test` - Run all tests once
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:ui` - Run tests with Vitest UI
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:unit` - Run unit tests only
- `pnpm test:integration` - Run integration tests only
- `pnpm test:e2e` - Run Playwright e2e tests

## Architecture Overview

### Dual Platform Architecture

The application supports **two distinct runtime environments**:

1. **Electron Desktop App**
   - Entry point: `src/main.tsx` (loaded by `index.html`)
   - Database: better-sqlite3 (native SQLite)
   - Backend: Electron main process with IPC communication
   - Build config: `vite.config.ts`

2. **Web Version**
   - Entry point: `src/main-web.tsx` (loaded by `index.html`)
   - Database: sql.js (WASM-based SQLite in browser)
   - Backend: In-browser via `src/database/web-backend.ts`
   - Build config: `vite.config.web.ts`

**Shared environment detection**: `src/env.ts` exports `isElectronRenderer()` used throughout components to conditionally render platform-specific UI (e.g., TitleBar vs WebTitleBar).

### Technology Stack
- **Frontend**: SolidJS with TypeScript
- **Styling**: Tailwind CSS v4 + DaisyUI v5
- **Desktop**: Electron v39 with vite-plugin-electron
- **Databases**:
  - better-sqlite3 (Electron, native SQLite)
  - sql.js (Web, WASM SQLite with IndexedDB persistence)
- **Build**: Vite + electron-builder
- **Package Manager**: pnpm (note: package.json references npm in scripts but project uses pnpm)

### Project Structure
```
src/
├── main.tsx                # Electron entry point
├── main-web.tsx           # Web entry point
├── App.tsx                # Platform-agnostic main app component
├── env.ts                 # Runtime environment detection
├── components/
│   ├── Timer.tsx          # Timer controls and display
│   ├── TimeList.tsx       # History list with inline editing
│   ├── TaskItem.tsx       # Individual time entry component
│   ├── SelectionSummary.tsx # Multi-select totals display
│   ├── ContextMenu.tsx    # Right-click context menu
│   ├── InlineEdit.tsx     # Editable text component
│   ├── DailySummary.tsx   # Daily time totals
│   ├── WeeklySummary.tsx  # Weekly time totals
│   ├── TitleBar.tsx       # Electron custom title bar
│   ├── WebTitleBar.tsx    # Web version header
│   ├── WebWrapper.tsx     # Web-specific layout wrapper
│   └── AppMenu.tsx        # Application menu (used in web)
├── database/
│   ├── database-sqljs.ts  # sql.js implementation (web)
│   └── web-backend.ts     # Singleton db + IPC-like API for web
├── types/
│   └── electron.d.ts      # TypeScript definitions for IPC APIs
└── utils/
    └── timeFormatting.ts  # Time/duration formatting utilities

electron/
├── main.ts                # Electron main process entry
├── preload.ts             # Context bridge for IPC communication
├── ipc-handlers.ts        # IPC event handlers
├── database-factory.ts    # Database abstraction layer (singleton)
└── database-better-sqlite3.ts # SQLite implementation for Electron

tests/
├── unit/                  # Unit tests for database services
├── integration/           # Integration tests for IPC and web backend
└── e2e/                   # Playwright end-to-end tests
```

### Database Architecture

**Electron (better-sqlite3)**
- Native SQLite with synchronous API
- WAL mode enabled for concurrent access
- Separate dev/prod databases: `chronii-dev.db` (development) / `chronii.db` (production)
- Location: User data directory (`app.getPath('userData')`)
- Singleton pattern via `database-factory.ts`
- Environment detection: Checks `process.env.VITE_DEV_SERVER_URL` to use dev vs prod database

**Web (sql.js)**
- WASM-based SQLite running in browser
- Async API with IndexedDB persistence
- Separate database service in `src/database/database-sqljs.ts`
- Web backend (`src/database/web-backend.ts`) provides IPC-like API mirroring Electron

**Schema** (shared across both platforms):
```sql
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  start_time INTEGER NOT NULL,     -- Unix timestamp (ms)
  end_time INTEGER,                 -- NULL for active timers
  logged INTEGER NOT NULL DEFAULT 0, -- Boolean flag (0/1)
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
```

### IPC Communication Pattern (Electron only)

- **Preload Script** (`electron/preload.ts`): Exposes `timerAPI`, `entriesAPI`, and `databaseAPI` to renderer via `contextBridge`
- **IPC Handlers** (`electron/ipc-handlers.ts`): Async handlers in main process for all database operations
- **Type Safety**: Shared `TimeEntry` interface ensures consistency between main and renderer processes
- **Web Equivalent**: `src/database/web-backend.ts` provides the same API surface (timerAPI, entriesAPI, databaseAPI) but calls sql.js directly

### State Management
- **Framework**: SolidJS signals (reactive primitives)
- **Timer State**: Managed in `Timer.tsx` with real-time updates
- **History State**: Managed in `TimeList.tsx` with refresh triggers
- **Cross-Component Communication**: Parent `App.tsx` coordinates updates via `refreshTrigger` and `timerRefreshTrigger` signals
- **Selection State**: Multi-select managed in `TimeList.tsx` with summary display via `SelectionSummary.tsx`

## Key Implementation Details

### Platform Detection
- `isElectronRenderer()` from `src/env.ts` detects runtime environment
- Used to conditionally render TitleBar (Electron) vs WebTitleBar (web)
- Components access backend APIs through either:
  - `window.timerAPI/entriesAPI/databaseAPI` (Electron, injected by preload)
  - `webBackend.timerAPI/entriesAPI/databaseAPI` (web, imported from `src/database/web-backend.ts`)

### Time Handling
- **Storage**: Unix timestamps in milliseconds
- **Timezone Handling**: Critical fix implemented - datetime-local inputs use manual local time extraction to prevent timezone shift bugs
- **Validation**: End time can equal start time (0-duration tasks allowed)
- **Formatting**: Centralized in `src/utils/timeFormatting.ts` with functions like `formatDuration()`, `formatTime()`, etc.

### Database Operations
- **Active Timer**: Only one timer can run at a time (auto-stops previous when starting new)
- **CRUD Operations**: Full create, read, update, delete via IPC (Electron) or web-backend (web)
- **Indexing**: Optimized with indexes on `start_time` and `task_name`
- **Logged Flag**: Time entries can be marked as "logged" (boolean stored as INTEGER 0/1 in SQLite)

### UI Patterns
- **Inline Editing**: `InlineEdit.tsx` component provides editable text fields
- **Context Menus**: Right-click support with `ContextMenu.tsx`
- **Selection**: Multi-select time entries with checkbox + summary display
- **Responsive Design**: Single-column layout optimized for small windows
- **Time Formatting**: Compact duration display (e.g., "2h 15m", "45m")
- **Sticky Header**: Timer and title bar remain visible while scrolling history
- **Untitled Tasks**: Tasks without names display as "(untitled)"

### Build Configuration
- **Vite Config (Electron)**: Externalizes 'sql.js' and 'better-sqlite3' for proper native module handling
- **Vite Config (Web)**: Excludes 'sql.js' from optimization to preserve WASM loader
- **TypeScript**: Strict mode with JSX preserve for SolidJS
- **Electron Builder**: Cross-platform builds configured in `package.json`:
  - Windows: NSIS installer (.exe)
  - macOS: DMG image (.dmg) for x64 and arm64
  - Linux: AppImage (.AppImage)

## Development Workflow

### Making Changes

**Database changes:**
1. Update schema in both `electron/database-better-sqlite3.ts` AND `src/database/database-sqljs.ts`
2. Update `electron/ipc-handlers.ts` for Electron IPC
3. Update `src/database/web-backend.ts` for web API
4. Ensure `TimeEntry` interface in `src/types/electron.d.ts` stays synchronized

**New IPC channels (Electron):**
1. Add handler in `electron/ipc-handlers.ts`
2. Expose via `contextBridge` in `electron/preload.ts`
3. Update TypeScript definitions in `src/types/electron.d.ts`

**New web backend methods:**
1. Add method to `webBackend` in `src/database/web-backend.ts`
2. Mirror the Electron IPC API surface for consistency

**Component changes:**
- Follow SolidJS patterns (signals, derived state with `createMemo`, effects with `createEffect`)
- Use `isElectronRenderer()` to conditionally access platform-specific APIs
- Always test timezone handling when working with datetime-local inputs

### Common Issues

#### Native Module Build Issues (better-sqlite3)

The project requires `better-sqlite3` to be built for both runtimes, even though they share the same Node.js version:

- **Electron app** (via `pnpm run dev`): Uses Electron 39's bundled Node.js 22.20.0
- **Tests** (via `pnpm test`): Use system Node.js 22.20.0

**Setup after fresh install:**
```bash
pnpm install          # Auto-rebuilds for Electron via postinstall
pnpm run dev          # Ready to run immediately
pnpm test             # Auto-rebuilds for Node.js via pretest on first run
```

**If you get "NODE_MODULE_VERSION mismatch" errors:**
- Error mentions ABI 123 but expected 137 → Run `pnpm run rebuild:node` then retry tests
- Error mentions ABI 137 but expected 123 → Run `pnpm run rebuild:electron` then retry app

**Manual rebuild commands:**
```bash
pnpm run rebuild:electron  # For Electron app (ABI 123)
pnpm run rebuild:node      # For tests (ABI 137)
```

**Why this happens:**
Native modules like `better-sqlite3` contain compiled C++ code that's tied to a specific Node.js runtime. Even when Electron and Node.js share the same version (22.20.0), Electron still bundles its own runtime, so separate builds for Electron and plain Node.js remain the safest approach.

**Best practice:**
- After `pnpm install`, you're ready for `pnpm run dev`
- The first `pnpm test` will rebuild automatically (via `pretest` hook)
- Don't manually switch between builds unless troubleshooting
- If switching contexts (dev → test → dev), the respective commands handle rebuilds

#### Other Common Issues
- **Timezone Bugs**: Use manual time component extraction for datetime-local inputs, never `toISOString()`
- **IPC Types**: Ensure `TimeEntry` interface stays synchronized between `electron/database-better-sqlite3.ts`, `src/database/database-sqljs.ts`, and `src/types/electron.d.ts`
- **Build Failures**: Check that native modules are properly externalized in `vite.config.ts`
- **Web WASM Loading**: Ensure sql.js is excluded from `optimizeDeps` in `vite.config.web.ts`

### Performance Considerations
- **Database (Electron)**: better-sqlite3 uses WAL mode for concurrent access
- **Database (Web)**: sql.js auto-saves to IndexedDB on changes (see `database-sqljs.ts`)
- **Reactivity**: Minimize signal dependencies to prevent unnecessary re-renders
- **Timer Updates**: 100ms intervals for smooth elapsed time display
- **History Loading**: Pagination support built-in but not currently used in UI

## Current Implementation Status

Reference `CHANGELOG.md` for accurate version history. Current version is v0.0.2 with:
- ✅ Basic time tracking with start/stop
- ✅ Inline editing of task names and times
- ✅ Daily/weekly summaries
- ✅ Multi-select with totals
- ✅ Mark tasks as logged
- ✅ Untitled tasks support
- ✅ Custom title bar (Electron)
- ✅ Dual platform support (Electron + web)
- ✅ Separate dev/prod databases
- ✅ Sticky timer header

## Testing

- **Unit Tests**: Test database services in isolation (`tests/unit/`)
- **Integration Tests**: Test IPC handlers and web backend APIs (`tests/integration/`)
- **E2E Tests**: Playwright tests for full user workflows (`tests/e2e/`)
- Run individual test suites with `pnpm test:unit`, `pnpm test:integration`, or `pnpm test:e2e`
