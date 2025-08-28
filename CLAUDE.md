# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChroniiJS is an Electron-based time tracking application built with SolidJS, Tailwind CSS, and DaisyUI. It provides a Clockify-like experience focused on offline-first time tracking with better-sqlite3 for data persistence.

## Essential Commands

### Development
- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Full production build (TypeScript → Vite → electron-builder)
- `pnpm run preview` - Preview built application
- `pnpm run rebuild` - Rebuild native dependencies (better-sqlite3)
- `pnpm postinstall` - Auto-rebuilds native dependencies after install

### Testing
- Testing framework is vitest (configured but tests directory is empty)
- Playwright report exists indicating e2e tests were planned but not implemented

## Architecture Overview

### Technology Stack
- **Frontend**: SolidJS with TypeScript
- **Styling**: Tailwind CSS v4 + DaisyUI v5
- **Desktop**: Electron v30 with vite-plugin-electron
- **Database**: better-sqlite3 (native SQLite)
- **Build**: Vite + electron-builder
- **Package Manager**: pnpm

### Project Structure
```
src/
├── App.tsx                 # Main application component
├── main.tsx               # SolidJS app entry point
├── components/            # UI components
│   ├── Timer.tsx         # Timer controls and display
│   ├── TimeList.tsx      # History list with inline editing
│   ├── TaskItem.tsx      # Individual time entry component
│   ├── ContextMenu.tsx   # Right-click context menu
│   ├── DailySummary.tsx  # Daily time totals
│   └── WeeklySummary.tsx # Weekly time totals
├── types/
│   └── electron.d.ts     # TypeScript definitions for IPC APIs
└── style.css             # Global styles

electron/
├── main.ts               # Electron main process entry
├── preload.ts            # Context bridge for IPC communication
├── ipc-handlers.ts       # IPC event handlers
├── database-factory.ts   # Database abstraction layer
└── database-better-sqlite3.ts # SQLite implementation
```

### Database Architecture
- **Engine**: better-sqlite3 for performance (replaces previous sql.js fallback)
- **Schema**: Single `time_entries` table with millisecond precision timestamps
- **Pattern**: Singleton factory pattern via `database-factory.ts`
- **Location**: User data directory (`app.getPath('userData')/chronii.db`)

### IPC Communication Pattern
- **Preload Script**: Exposes `timerAPI`, `entriesAPI`, and `databaseAPI` to renderer
- **IPC Handlers**: Async handlers in main process for all database operations
- **Type Safety**: Shared TypeEntry interface ensures consistency

### State Management
- **Framework**: SolidJS signals (reactive primitives)
- **Timer State**: Managed in Timer.tsx with real-time updates
- **History State**: Managed in TimeList.tsx with refresh triggers
- **Cross-Component**: Parent App.tsx coordinates updates between Timer and TimeList

## Key Implementation Details

### Time Handling
- **Storage**: Unix timestamps in milliseconds
- **Timezone Handling**: Critical fix implemented - datetime-local inputs use manual local time extraction to prevent timezone shift bugs
- **Validation**: End time can equal start time (0-duration tasks allowed)

### Database Operations
- **Active Timer**: Only one timer can run at a time (auto-stops previous)
- **CRUD Operations**: Full create, read, update, delete via IPC
- **Indexing**: Optimized with indexes on start_time and task_name

### UI Patterns
- **Inline Editing**: TaskItem.tsx switches between display/edit modes
- **Context Menus**: Right-click support with ContextMenu.tsx
- **Responsive Design**: Single-column layout optimized for small windows
- **Time Formatting**: Compact duration display (e.g., "2h 15m", "45m")

### Build Configuration
- **Vite Config**: Externalizes 'better-sqlite3' for proper native module handling
- **TypeScript**: Strict mode with JSX preserve for SolidJS
- **Electron Builder**: Cross-platform builds (Windows NSIS, macOS DMG, Linux AppImage)

## Development Workflow

### Making Changes
1. Database changes require updating both `database-better-sqlite3.ts` and `ipc-handlers.ts`
2. New IPC channels need registration in `preload.ts` and `ipc-handlers.ts`
3. Component changes should follow SolidJS patterns (signals, derived state)
4. Always test timezone handling when working with datetime-local inputs

### Common Issues
- **Native Modules**: Run `pnpm run rebuild` after adding native dependencies
- **Timezone Bugs**: Use manual time component extraction, never `toISOString()` for datetime-local
- **IPC Types**: Ensure TypeEntry interface stays synchronized across files
- **Build Failures**: Check that native modules are properly externalized in vite.config.ts

### Performance Considerations
- **Database**: better-sqlite3 uses WAL mode for concurrent access
- **Reactivity**: Minimize signal dependencies to prevent unnecessary re-renders
- **Timer Updates**: 100ms intervals for smooth elapsed time display
- **History Loading**: Pagination support built-in but not currently used in UI

## Specification Reference

The project follows a detailed specification in SPEC.md which includes:
- Complete database schema
- Phase-based development approach (currently in Phase 7)
- Future roadmap including mobile support and cloud sync
- Success criteria and architecture decisions

Refer to SPEC.md for comprehensive requirements and implementation status.