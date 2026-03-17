# ChroniiJS

A simple, offline-first time tracking desktop app. Track work sessions, review daily and weekly totals, and keep everything stored locally.

**Try it in your browser:** [chronii.mitchellwallace.net](https://chronii.mitchellwallace.net)

## Features

- Start/stop timers with optional task names
- Edit task names, start times, and end times inline
- View daily and weekly time totals
- Select multiple entries to see combined duration
- Mark entries as logged
- Remembers active timers across restarts
- All data stored locally — nothing leaves your machine

## Install

Download the latest release for your platform from the [Releases](https://github.com/mitchell-wallace/ChroniiJS/releases) page:

- **Windows** — Run the `.exe` installer
- **macOS** — Open the `.dmg` and drag to Applications
- **Linux** — Download the `.AppImage` and run it

> **Note:** Not all versions are available for all platforms. Check the release assets to see what's provided for your OS.

> **Linux tip:** Use [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) to integrate AppImages with your desktop environment (app menu, file associations, etc.).

## Build from Source

Requires **Node.js** v18+ and **pnpm**.

```bash
git clone https://github.com/mitchell-wallace/ChroniiJS.git
cd ChroniiJS
pnpm install
```

Build installers:

```bash
pnpm run build          # All platforms
pnpm run build:win      # Windows
pnpm run build:mac      # macOS
pnpm run build:linux    # Linux
```

Installers are output to the `release/` directory.

## Data Storage

Your time entries are stored in a local SQLite database:

| Platform | Location |
|----------|----------|
| Windows  | `%APPDATA%/chroniijs/chronii.db` |
| macOS    | `~/Library/Application Support/chroniijs/chronii.db` |
| Linux    | `~/.config/chroniijs/chronii.db` |

The web version stores data in your browser's IndexedDB. Nothing is synced to a server.

---

## Development

### Getting Started

```bash
pnpm install
pnpm run dev        # Electron desktop app
pnpm run dev:web    # Web version (http://localhost:5173)
```

Development uses a separate database (`chronii-dev.db`) so your production data is never affected.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Electron dev mode |
| `pnpm run dev:web` | Web dev mode |
| `pnpm run check` | TypeScript type check |
| `pnpm run rebuild` | Rebuild native dependencies |
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Unit tests only |
| `pnpm test:integration` | Integration tests only |
| `pnpm test:e2e` | Playwright e2e tests |

### Tech Stack

- **Frontend:** SolidJS + TypeScript
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Desktop:** Electron v30
- **Database:** better-sqlite3 (Electron) / sql.js with IndexedDB (web)
- **Build:** Vite + electron-builder
- **Testing:** Vitest + Playwright

### Troubleshooting

**Native module build failures**
```bash
pnpm run rebuild
```

**Web version not loading**
- Make sure you're using `pnpm run dev:web`, not `pnpm run dev`
- Check the browser console for WASM errors

**Module not found errors**
```bash
rm -rf node_modules && pnpm install
```

## License

[Add your license information here]
