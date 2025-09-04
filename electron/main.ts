import { app, BrowserWindow, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { closeDatabase } from './database-factory'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')
// Ensure Chromium overlay scrollbars are enabled so ::-webkit-scrollbar styling applies on Windows
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Injected CSS to enforce ultra-minimal scrollbars consistently across platforms
const SCROLLBAR_CSS = `
/* Global minimal scrollbar */
* {
  scrollbar-width: thin !important;
  scrollbar-color: hsl(var(--bc) / 0.08) transparent !important;
}
*::-webkit-scrollbar {
  width: 4px !important;
  height: 4px !important;
  background: transparent !important;
  -webkit-appearance: none !important;
}
*::-webkit-scrollbar-track,
*::-webkit-scrollbar-track-piece,
*::-webkit-scrollbar-corner {
  background: transparent !important;
  box-shadow: none !important;
}
*::-webkit-scrollbar-thumb {
  background-color: hsl(var(--bc) / 0.06) !important;
  border-radius: 2px !important;
  border: none !important;
}
*::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--bc) / 0.15) !important;
}
*::-webkit-scrollbar-thumb:active {
  background-color: hsl(var(--bc) / 0.25) !important;
}
/* Hide any scrollbar arrows/buttons entirely */
*::-webkit-scrollbar-button {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
`

let win: BrowserWindow | null

function createWindow() {
  // Use appropriate icon format for each platform
  let iconPath: string
  if (process.platform === 'win32') {
    iconPath = path.join(process.env.VITE_PUBLIC, 'chronii-js-logo.ico')
  } else {
    // macOS and Linux work well with PNG
    iconPath = path.join(process.env.VITE_PUBLIC, 'chronii-js-logo-256.png')
  }

  win = new BrowserWindow({
    width: 400,
    height: 610,
    minWidth: 320,
    minHeight: 400,
    icon: iconPath,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Inject enforced minimal scrollbar CSS at runtime to override any stylesheet ordering issues
  win.webContents.on('dom-ready', () => {
    win?.webContents.insertCSS(SCROLLBAR_CSS).catch((err) => {
      console.error('Failed to insert scrollbar CSS', err)
    })
  })

  // Remove app menu and hide menu bar
  Menu.setApplicationMenu(null)
  win.setMenuBarVisibility(false)


  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
    win = null
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Set app name for better taskbar/dock identification
  app.setName('Chronii')
  
  registerIpcHandlers()
  createWindow()
})
