# ChroniiJS - Time Tracking Application Specification

## Overview
ChroniiJS is a simple, offline-first time tracking application built as an Electron app using SolidJS, Tailwind CSS, and DaisyUI. It provides a Clockify-like experience focused on ease of use for tracking time across multiple work sessions.

## Core Requirements

### Functional Requirements
1. **Time Tracking**
   - Start/stop timer functionality
   - Display current running time
   - Track time with millisecond precision
   - Remember active timers across app restarts

2. **Task Management**
   - Simple task names (no project hierarchy)
   - Quick start new timer with same task name as previous
   - Edit task names after creation

3. **Time Entry Management**
   - View scrollable history of all time entries
   - Edit time entries (task name, start time, end time)
   - Delete time entries
   - One database record per time entry

4. **Display & Reporting**
   - Single window interface
   - Inline daily and weekly totals in history view
   - Group consecutive same-name tasks with total time
   - Expandable/collapsible task groups
   - Date-based filtering and navigation

5. **Data Persistence**
   - SQLite database using better-sqlite3
   - Local storage only (no cloud sync)
   - Automatic data backup/recovery

### Non-Functional Requirements
1. **Performance**
   - Fast startup time
   - Smooth scrolling through large entry lists
   - Responsive UI updates

2. **Usability**
   - Keyboard shortcuts for common actions
   - Intuitive single-window interface
   - Clear visual feedback for timer state

3. **Reliability**
   - Data integrity across app crashes
   - Session recovery
   - Graceful error handling

## Technical Architecture

### Technology Stack
- **Frontend**: SolidJS + Tailwind CSS + DaisyUI
- **Backend**: Electron main process
- **Database**: SQLite with better-sqlite3
- **Build System**: electron-vite
- **Package Manager**: pnpm

### Database Schema
```sql
CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  start_time INTEGER NOT NULL,  -- Unix timestamp in milliseconds
  end_time INTEGER,             -- NULL for active timers
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_task_name ON time_entries(task_name);
```

### Application Structure
```
src/
├── main/                   # Electron main process
│   ├── index.ts           # Main entry point
│   ├── database.ts        # SQLite database service
│   └── ipc-handlers.ts    # IPC message handlers
├── renderer/              # SolidJS frontend
│   ├── App.tsx           # Main app component
│   ├── components/       # UI components
│   │   ├── Timer.tsx     # Timer display and controls
│   │   ├── TaskInput.tsx # Task name input
│   │   ├── TimeList.tsx  # Time entries history
│   │   └── Summary.tsx   # Daily/weekly totals
│   ├── services/         # Frontend services
│   │   └── ipc.ts        # IPC communication
│   └── types/            # TypeScript types
│       └── index.ts
├── preload/              # Electron preload scripts
│   └── index.ts
└── shared/               # Shared types and utilities
    └── types.ts
```

### Data Model
```typescript
interface TimeEntry {
  id: number;
  taskName: string;
  startTime: number;      // Unix timestamp in milliseconds
  endTime: number | null; // null for active timers
  createdAt: number;
  updatedAt: number;
}

interface TimerState {
  isRunning: boolean;
  currentEntry: TimeEntry | null;
  startTime: number | null;
}
```

## User Interface Design

### Main Window Layout
- **Header**: Current timer display and controls
- **Body**: Scrollable time entries list with grouping
- **Footer**: Daily/weekly summary totals

### Key Components
1. **Timer Section**
   - Current task name input
   - Start/Stop button
   - Running time display
   - Quick start buttons for recent tasks

2. **History Section**
   - Scrollable list of time entries
   - Grouped by consecutive same-name tasks
   - Inline editing capabilities
   - Date headers and daily totals

3. **Summary Section**
   - Current day total
   - Current week total
   - Quick stats

### Theme & Styling
- **Framework**: DaisyUI with Tailwind CSS
- **Theme**: Clean, minimal design
- **Colors**: Professional color scheme suitable for work environment
- **Typography**: Clear, readable fonts
- **Spacing**: Generous whitespace for readability

## Implementation Status

**Current Phase: Phase 1 - Foundation Setup**

### Completed
- ✅ Basic electron-vite project structure
- ✅ Project specification and requirements

### In Progress
- 🔄 Adding SolidJS framework integration
- 🔄 Setting up Tailwind CSS and DaisyUI
- 🔄 Configuring Vite for SolidJS + Electron

### Pending
- ⏳ Database service implementation
- ⏳ Core timer functionality
- ⏳ Task management features
- ⏳ UI components and styling

## Development Phases

### Phase 1: Electron Foundation
- Set up electron-vite build system ✅
- Configure main/renderer/preload processes ✅
- Install and configure dependencies 🔄
- Basic IPC communication ⏳

### Phase 2: Database & Core Timer
- Implement SQLite database service
- Create time entry CRUD operations
- Build basic timer functionality
- Timer display component

### Phase 3: Task Management & History
- Task name input and management
- Time entry history display
- Quick start functionality
- Basic editing capabilities

### Phase 4: Session Recovery & Advanced Editing
- Persist timer state across restarts
- Advanced editing (inline/modal)
- Data validation and error handling
- Session recovery logic

### Phase 5: Display Enhancements
- Task grouping and collapsing
- Daily/weekly calculations
- Date navigation
- Enhanced UI with DaisyUI

### Phase 6: Final Polish
- Keyboard shortcuts
- Performance optimization
- Data export capabilities
- Final testing and bug fixes

## Success Criteria
- Can track time on named tasks reliably
- Remembers active timers across app restarts
- Provides clear history view with grouping
- Handles editing of past entries
- Maintains data integrity
- Intuitive single-window interface
- Fast and responsive performance

## Future Enhancements (Out of Scope)
- Cloud synchronization
- Advanced reporting
- Time categorization/tagging  
- Automated time detection
- Team collaboration features
- Mobile companion app