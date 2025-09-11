# ChroniiJS

A simple, offline-first time tracking application built with Electron, SolidJS, and SQLite. ChroniiJS provides a clean, Clockify-like experience for tracking work sessions with millisecond precision.

![ChroniiJS Interface](https://via.placeholder.com/600x400?text=ChroniiJS+Time+Tracker)

## ✨ Features

- **⏱️ Precise Time Tracking** - Start/stop timers with millisecond precision
- **📝 Task Management** - Simple task names with quick restart functionality (task names are optional)
- **📊 History & Analytics** - View all time entries with daily/weekly totals
- **✏️ Inline Editing** - Edit task names, start times, and end times directly in the list
- **💾 Offline-First** - All data stored locally with SQLite database
- **🔄 Session Recovery** - Remembers active timers across app restarts
- **📱 Compact Design** - Optimized for small windows and focused workflows
- **🏷️ Untitled Tasks** - Start timers without a task name; they'll appear as "(untitled)" in history

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (Node.js package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ChroniiJS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **⚠️ Approve build scripts** (Required for security)
   ```bash
   npm run approve-scripts
   ```
   When prompted, approve the build scripts for:
   - `electron` (Electron framework)
   - `better-sqlite3` (Native SQLite bindings)

4. **Rebuild native modules**
   ```bash
   npm run rebuild
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build and installer |
| `npm run preview` | Preview the built application |
| `npm run rebuild` | Rebuild native dependencies (better-sqlite3) |

## 🏗️ Architecture

### Technology Stack

- **Frontend**: SolidJS + TypeScript
- **Styling**: Tailwind CSS v4 + DaisyUI v5
- **Desktop**: Electron v30
- **Database**: better-sqlite3 (native SQLite)
- **Build System**: Vite + electron-builder
- **Package Manager**: npm

### Key Components

- **Timer.tsx** - Timer controls and real-time display
- **TimeList.tsx** - History view with inline editing
- **TaskItem.tsx** - Individual time entry management
- **Database Layer** - SQLite with better-sqlite3 for performance

### Data Storage

All time entries are stored locally in a SQLite database located at:
- **Windows**: `%APPDATA%/chroniijs/chronii.db`
- **macOS**: `~/Library/Application Support/chroniijs/chronii.db` 
- **Linux**: `~/.config/chroniijs/chronii.db`

## 🛠️ Development

### Project Structure

```
ChroniiJS/
├── src/                    # SolidJS frontend
│   ├── components/         # UI components
│   ├── types/             # TypeScript definitions
│   └── App.tsx            # Main application
├── electron/              # Electron main process
│   ├── main.ts            # App entry point
│   ├── preload.ts         # IPC bridge
│   ├── database-*.ts      # Database layer
│   └── ipc-handlers.ts    # API handlers
├── dist/                  # Built frontend assets
├── dist-electron/         # Built electron files
└── release/               # Final application installers
```

### Building for Distribution

Create installers for all platforms:
```bash
npm run build
```

Installers will be created in the `release/` directory:
- **Windows**: NSIS installer (`.exe`)
- **macOS**: DMG image (`.dmg`)
- **Linux**: AppImage (`.AppImage`)

### Database Schema

```sql
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  start_time INTEGER NOT NULL,  -- Unix timestamp (ms)
  end_time INTEGER,             -- NULL for active timers
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
```

## 🐛 Troubleshooting

### Common Issues

**Build script approval required**
```bash
# If you see permission errors, approve the scripts:
npm run approve-scripts
```

**Native module build failures**
```bash
# Rebuild native dependencies:
npm run rebuild

# Or manually:
npx electron-rebuild -f -w better-sqlite3
```

**Database connection issues**
- Check that the app has write permissions to the user data directory
- Verify better-sqlite3 native module is properly built

**TypeScript errors during build**
- Ensure all dependencies are installed: `npm install`
- Check that TypeScript version is compatible: `npm list typescript`

## 📖 Documentation

- **[SPEC.md](./SPEC.md)** - Complete project specification and requirements
- **[CLAUDE.md](./CLAUDE.md)** - Development guide for Claude Code instances

## 🔧 Configuration

### Electron Builder

Application metadata can be configured in `electron-builder.json5`:
- App name, ID, and version
- Platform-specific build options
- Installer configurations

### Database

Database configuration is handled automatically:
- Uses better-sqlite3 for optimal performance
- WAL mode enabled for concurrent access
- Automatic schema creation and migrations

## 📊 Current Status

ChroniiJS is currently in **Phase 7** development with core functionality complete:

- ✅ Timer functionality with session recovery
- ✅ Time entry management and editing
- ✅ Daily/weekly analytics
- ✅ Compact, professional UI design
- ✅ Cross-platform builds

See [SPEC.md](./SPEC.md) for detailed implementation status and future roadmap.

## 📝 License

[Add your license information here]

---

**Built with ❤️ using Electron, SolidJS, and modern web technologies.**