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

**Current Phase: Phase 3 - Task Management & History**

### Completed
- ✅ Basic electron-vite project structure
- ✅ Project specification and requirements
- ✅ SolidJS framework integration
- ✅ Tailwind CSS and DaisyUI setup
- ✅ Vite configuration for SolidJS + Electron
- ✅ SQLite database service (sql.js implementation)
- ✅ Core timer functionality with start/stop
- ✅ IPC communication between main and renderer
- ✅ Timer state management with SolidJS signals
- ✅ Real-time timer display with millisecond precision
- ✅ Time entry history view with date grouping
- ✅ Quick start buttons for recent tasks
- ✅ Inline editing for task names and times
- ✅ Delete functionality for time entries
- ✅ Compact, Clockify-like UI design
- ✅ Integrated daily totals in history headers
- ✅ Single-column layout optimized for small windows

### Recently Completed (Phases 1-5)
- ✅ Session recovery across app restarts

### Pending (Phase 6+)
- ⏳ Data export/import capabilities  
- ⏳ Data reset functionality
- ⏳ Keyboard shortcuts
- ⏳ Performance optimization

## Development Phases

### Phase 1: Electron Foundation ✅
- Set up electron-vite build system ✅
- Configure main/renderer/preload processes ✅
- Install and configure dependencies ✅
- Basic IPC communication ✅

### Phase 2: Database & Core Timer ✅
- Implement SQLite database service ✅
- Create time entry CRUD operations ✅
- Build basic timer functionality ✅
- Timer display component ✅

### Phase 3: Task Management & History ✅
- Task name input and management ✅
- Time entry history display ✅
- Quick start functionality ✅
- Basic editing capabilities ✅

### Phase 4: Session Recovery & Advanced Editing ✅
- Persist timer state across restarts ✅
- Advanced editing (inline/modal) ✅
- Data validation and error handling ✅
- Session recovery logic ✅

### Phase 5: Display Enhancements ✅
- Task grouping and collapsing ✅
- Daily/weekly calculations ✅
- Date navigation ✅
- Enhanced UI with DaisyUI ✅

### Phase 6: Final Polish
- Keyboard shortcuts
- Performance optimization
- Data export capabilities

## Success Criteria
- Can track time on named tasks reliably
- Remembers active timers across app restarts
- Provides clear history view with grouping
- Handles editing of past entries
- Maintains data integrity
- Intuitive single-window interface
- Fast and responsive performance

## Phase 7: Cross-Platform Optimization & Database Enhancement

### 7.1 Database Performance & Web Compatibility
**Priority: High** - Enable full web/desktop feature parity

1. **Switch to better-sqlite3 for Electron**
   - Replace sql.js with better-sqlite3 for improved performance
   - Configure electron-vite for proper native module handling
   - Add electron-rebuild scripts for cross-platform compatibility
   - Maintain sql.js fallback for web deployment

2. **Web Version Database Optimization**
   - Optimize sql.js implementation for web browsers
   - Implement proper database persistence in browser storage
   - Add database migration utilities for schema updates

### 7.2 UI Architecture & Component Refactoring
**Priority: Medium** - Improve maintainability and user experience

3. **TimeList Component Breakdown**
   - Extract `TimeEntry` component for individual entries
   - Extract `DateGroup` component for date headers with totals
   - Maintain `TimeList` as container with state management
   - Improve component reusability and testing

4. **Scrolling & Layout Improvements**
   - Remove nested scrollable containers (list-specific scrolling)
   - Let TimeList expand naturally with app-level scrolling
   - Optimize for small window sizes and mobile viewports

5. **Custom Title Bar Implementation**
   - Remove standard Electron menu bar
   - Implement custom title bar with platform-neutral window controls
   - Add drag-to-move functionality
   - Ensure consistent experience across platforms

### 7.3 Enhanced User Interaction
**Priority: Medium** - Improve user workflow and productivity

6. **Context Menu System**
   - Right-click context menu for time entries
   - Actions: Edit, Delete, Duplicate, Start Timer, Copy Details
   - Keyboard shortcuts for common actions
   - Consistent UX patterns across components

7. **Projects & Organization**
   - Add project separation within single database
   - Project-based filtering for time entries and summaries
   - Project selector in timer interface
   - Per-project analytics and reporting

### 7.4 Data Management & Portability
**Priority: Medium** - Enable data backup and migration

8. **Data Export/Import/Reset**
   - CSV export with fields: task, start, end, duration, project
   - CSV import with data validation and conflict resolution
   - Database reset functionality with confirmation
   - Backup/restore capabilities for data safety

### 7.5 Architecture Preparation for Future Platforms
**Priority: Low** - Future-proofing for mobile and alternative frameworks

9. **Loose Coupling Architecture**
   - Separate core SolidJS application logic from deployment layers
   - Abstract database layer for multiple backend implementations
   - Prepare for potential Capacitor mobile deployment
   - Consider Tauri wrapper evaluation for performance comparison

## Future Enhancement Roadmap

### Phase 8: Advanced Features (Future Scope)
- **Mobile Application**: Capacitor-based mobile app with data sync
- **Alternative Frameworks**: Tauri wrapper evaluation for performance
- **Cloud Integration**: Optional cloud backup and synchronization
- **Productivity Features**: Integrated todo lists and quick notes
- **Advanced Analytics**: Detailed reporting and time analysis
- **Team Features**: Collaboration and shared project management

### Implementation Strategy
- Maintain backward compatibility throughout upgrades
- Implement feature flags for gradual rollout
- Ensure data migration paths for all database changes
- Test cross-platform compatibility at each phase
- Document API changes for future integrations

## Success Criteria for Phase 7
- ✅ Web and desktop versions have complete feature parity
- ✅ Database performance significantly improved on desktop
- ✅ UI components are well-organized and maintainable
- ✅ Users can manage projects and export their data
- ✅ Application works seamlessly in small windows
- ✅ Architecture supports future platform additions