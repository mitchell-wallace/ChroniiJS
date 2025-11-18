# ChroniiJS

A simple, offline-first time tracking application built with SolidJS, Tailwind CSS, and SQLite. ChroniiJS runs as both an Electron desktop app and a web application, providing a clean, Clockify-like experience for tracking work sessions with millisecond precision.

![ChroniiJS Interface](https://via.placeholder.com/600x400?text=ChroniiJS+Time+Tracker)

## ✨ Features

- **⏱️ Precise Time Tracking** - Start/stop timers with millisecond precision
- **📝 Task Management** - Simple task names with quick restart functionality (task names are optional)
- **📊 History & Analytics** - View all time entries with daily/weekly totals
- **✏️ Inline Editing** - Edit task names, start times, and end times directly in the list
- **☑️ Multi-Select** - Select multiple entries to see total time across tasks
- **📌 Mark as Logged** - Flag time entries as logged for tracking what's been submitted
- **💾 Offline-First** - All data stored locally with SQLite database
- **🔄 Session Recovery** - Remembers active timers across app restarts
- **📱 Compact Design** - Optimized for small windows and focused workflows
- **🏷️ Untitled Tasks** - Start timers without a task name; they'll appear as "(untitled)" in history
- **🌐 Dual Platform** - Available as Electron desktop app and web application

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **pnpm** (Fast, disk space efficient package manager)

Install pnpm globally if you haven't already:
```bash
npm install -g pnpm
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ChroniiJS
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```
   This will automatically rebuild native dependencies via the `postinstall` script.

3. **Start development**

   For the **Electron desktop app**:
   ```bash
   pnpm run dev
   ```

   For the **web version**:
   ```bash
   pnpm run dev:web
   ```
   Then open http://localhost:5173 in your browser.

## 📋 Available Scripts

### Development
| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start Electron desktop app in development mode |
| `pnpm run dev:web` | Start web version in development mode |
| `pnpm run check` | Type check with TypeScript (no emit) |
| `pnpm run rebuild` | Rebuild native dependencies (better-sqlite3) |

### Building
| Command | Description |
|---------|-------------|
| `pnpm run build` | Full Electron production build and installer |
| `pnpm run build:web` | Build web version only |
| `pnpm run build:win` | Build Windows installer only |
| `pnpm run build:mac` | Build macOS installer only |
| `pnpm run build:linux` | Build Linux installer only |
| `pnpm run preview` | Preview Electron build |
| `pnpm run preview:web` | Preview web build |

### Testing
| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests once |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:ui` | Run tests with Vitest UI |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:unit` | Run unit tests only |
| `pnpm test:integration` | Run integration tests only |
| `pnpm test:e2e` | Run Playwright e2e tests |

## 🏗️ Architecture

### Dual Platform Support

ChroniiJS runs in two modes:

1. **Electron Desktop App** - Native desktop application with better-sqlite3 database
2. **Web Application** - Browser-based version using sql.js (WASM SQLite) with IndexedDB persistence

Both versions share the same UI components and business logic, with platform-specific backends.

### Technology Stack

- **Frontend**: SolidJS + TypeScript
- **Styling**: Tailwind CSS v4 + DaisyUI v5
- **Desktop**: Electron v30
- **Databases**:
  - better-sqlite3 (Electron, native SQLite)
  - sql.js (Web, WASM SQLite with IndexedDB)
- **Build System**: Vite + electron-builder
- **Testing**: Vitest + Playwright
- **Package Manager**: pnpm

### Key Components

- **Timer.tsx** - Timer controls and real-time display
- **TimeList.tsx** - History view with inline editing and multi-select
- **TaskItem.tsx** - Individual time entry management
- **SelectionSummary.tsx** - Multi-select totals display
- **InlineEdit.tsx** - Editable text fields for task names and times
- **DailySummary.tsx** / **WeeklySummary.tsx** - Time analytics
- **Database Layer** - Platform-specific SQLite implementations with shared schema

### Data Storage

**Electron Desktop App:**

All time entries are stored locally in SQLite databases. The Electron app uses separate databases for development and production:

- **Production Database:**
  - **Windows**: `%APPDATA%/chroniijs/chronii.db`
  - **macOS**: `~/Library/Application Support/chroniijs/chronii.db`
  - **Linux**: `~/.config/chroniijs/chronii.db`

- **Development Database (when using `pnpm run dev`):**
  - **Windows**: `%APPDATA%/chroniijs/chronii-dev.db`
  - **macOS**: `~/Library/Application Support/chroniijs/chronii-dev.db`
  - **Linux**: `~/.config/chroniijs/chronii-dev.db`

This separation ensures that development work doesn't interfere with your production time tracking data.

**Web Application:**

The web version stores data in the browser using IndexedDB. Data is persisted locally in your browser and is not synced to any server. Each browser maintains its own separate database.

## 🛠️ Development

### Project Structure

```
ChroniiJS/
├── src/                       # SolidJS frontend
│   ├── main.tsx               # Electron entry point
│   ├── main-web.tsx           # Web entry point
│   ├── App.tsx                # Platform-agnostic main app
│   ├── components/            # UI components
│   ├── database/              # Web database layer
│   │   ├── database-sqljs.ts  # sql.js implementation
│   │   └── web-backend.ts     # Web IPC-like API
│   ├── types/                 # TypeScript definitions
│   └── utils/                 # Utility functions
├── electron/                  # Electron main process
│   ├── main.ts                # App entry point
│   ├── preload.ts             # IPC bridge
│   ├── database-factory.ts    # Database abstraction
│   ├── database-better-sqlite3.ts # SQLite implementation
│   └── ipc-handlers.ts        # IPC API handlers
├── tests/                     # Test suites
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── e2e/                   # End-to-end tests
├── dist/                      # Built Electron frontend
├── dist-web/                  # Built web version
├── dist-electron/             # Built electron main process
└── release/                   # Final application installers
```

### Development Database Management

**Electron:**

The Electron development environment uses a separate database (`chronii-dev.db`) to avoid interfering with your production data.

**Reset Development Database:**
To start fresh with development data, delete the development database file:

```bash
# Windows (PowerShell)
Remove-Item "$env:APPDATA\chroniijs\chronii-dev.db" -ErrorAction SilentlyContinue

# macOS/Linux
rm ~/Library/Application\ Support/chroniijs/chronii-dev.db  # macOS
rm ~/.config/chroniijs/chronii-dev.db                      # Linux
```

The database will be recreated automatically the next time you run `pnpm run dev`.

**Web:**

The web version stores data in your browser's IndexedDB. To reset:
1. Open browser DevTools (F12)
2. Go to Application > Storage > IndexedDB
3. Delete the ChroniiJS database

### Building for Distribution

**Electron Desktop App:**

Create installers for all platforms:
```bash
pnpm run build          # All platforms
pnpm run build:win      # Windows only
pnpm run build:mac      # macOS only
pnpm run build:linux    # Linux only
```

Installers will be created in the `release/` directory:
- **Windows**: NSIS installer (`.exe`)
- **macOS**: DMG image (`.dmg`) for x64 and arm64
- **Linux**: AppImage (`.AppImage`)

**Web Application:**

Build the web version:
```bash
pnpm run build:web
```

Output will be in the `dist-web/` directory, ready to deploy to any static hosting service.

### Database Schema

The schema is identical across both Electron and web versions:

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

## 🐛 Troubleshooting

### Common Issues

**Native module build failures (Electron)**
```bash
# Rebuild native dependencies:
pnpm run rebuild

# Or manually:
npx electron-rebuild -f -w better-sqlite3
```

**Database connection issues (Electron)**
- Check that the app has write permissions to the user data directory
- Verify better-sqlite3 native module is properly built with `pnpm run rebuild`
- In development, check if `chronii-dev.db` exists in the user data directory
- For production issues, check if `chronii.db` exists in the user data directory

**Web version not loading sql.js**
- Ensure you're using `pnpm run dev:web` (not `pnpm run dev`)
- Check browser console for WASM loading errors
- Verify sql.js files are present in `node_modules/sql.js/dist/`

**TypeScript errors during build**
- Ensure all dependencies are installed: `pnpm install`
- Check that TypeScript version is compatible: `pnpm list typescript`

**Module not found errors**
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- Rebuild native modules: `pnpm run rebuild`

## 📖 Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for Claude Code instances

## 🔧 Configuration

### Electron Builder

Application metadata is configured in the `build` section of `package.json`:
- App name, ID, and version
- Platform-specific build options (Windows, macOS, Linux)
- Installer configurations (NSIS, DMG, AppImage)

### Database

Database configuration is handled automatically:
- **Electron**: Uses better-sqlite3 with WAL mode for concurrent access
- **Web**: Uses sql.js with IndexedDB persistence
- Automatic schema creation on first run
- Environment-based database selection (dev vs production)

## 📊 Current Status

**Current Version: v0.0.2**

ChroniiJS is in active development with core functionality complete:

- ✅ Timer functionality with session recovery
- ✅ Time entry management with inline editing
- ✅ Daily and weekly time analytics
- ✅ Multi-select with total time calculations
- ✅ Mark entries as logged
- ✅ Untitled task support
- ✅ Custom title bar and compact UI design
- ✅ Dual platform support (Electron + Web)
- ✅ Separate development and production databases
- ✅ Cross-platform builds (Windows, macOS, Linux)

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and release notes.

## 📝 License

[Add your license information here]

---

**Built with SolidJS, Electron, Tailwind CSS, and modern web technologies.**