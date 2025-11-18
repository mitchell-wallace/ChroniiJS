import { Component, createSignal, createEffect, For, Show, onCleanup, createMemo } from 'solid-js';
import type { TimeEntry } from '../types/electron';
import { formatDateTimeForInput, parseInputDateTime } from '../utils/timeFormatting';
import WeeklySummary, { type WeeklyGroup } from './WeeklySummary';
import SelectionSummary from './SelectionSummary';
import ProjectDropdown from './ProjectDropdown';
import ProjectModal from './ProjectModal';

interface TimeListProps {
  onEntryUpdate?: () => void;
  refreshTrigger?: number;
  selectedProject: string | null | undefined;
  onProjectChange: (project: string | null | undefined) => void;
}

const TimeList: Component<TimeListProps> = (props) => {
  const [entries, setEntries] = createSignal<TimeEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [editingEntry, setEditingEntry] = createSignal<number | null>(null);
  const [editValues, setEditValues] = createSignal<{
    taskName: string;
    project: string | null;
    startTime: string;
    endTime: string;
  }>({ taskName: '', project: null, startTime: '', endTime: '' });
  const [currentTime, setCurrentTime] = createSignal(Date.now());
  const [selectedTaskIds, setSelectedTaskIds] = createSignal<Set<number>>(new Set());
  const [projects, setProjects] = createSignal<string[]>([]);
  const [showProjectModal, setShowProjectModal] = createSignal(false);
  const [projectModalMode, setProjectModalMode] = createSignal<'create' | 'rename'>('create');
  const [projectToRename, setProjectToRename] = createSignal<string | undefined>(undefined);
  // Track where the project modal was opened from so we can adjust behavior
  // - 'view': opened from the History view dropdown (changes active filter)
  // - 'edit': opened from the task edit modal (should NOT change the view)
  const [projectModalSource, setProjectModalSource] = createSignal<'view' | 'edit'>('view');
  let liveUpdateInterval: number | null = null;

  // Load time entries and projects on component mount
  createEffect(async () => {
    await loadEntries();
    await loadProjects();
  });

  // Reload entries when refresh trigger changes
  createEffect(async () => {
    if (props.refreshTrigger !== undefined) {
      await loadEntries();
      await loadProjects();
    }
  });

  // Reload entries when selected project changes
  createEffect(async () => {
    props.selectedProject; // Track dependency
    await loadEntries();
  });

  // Live update current time every second for running timers
  createEffect(() => {
    const hasRunningTimers = entries().some(entry => !entry.endTime);
    
    // Clear existing interval
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
    
    if (hasRunningTimers) {
      liveUpdateInterval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000) as unknown as number; // Update every second for seconds precision
    }
  });

  // Cleanup interval on component unmount
  onCleanup(() => {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
    }
  });

  const loadEntries = async () => {
    try {
      setLoading(true);
      const project = props.selectedProject;
      const allEntries = await window.entriesAPI.getAllEntries(50, 0, project); // Get last 50 entries
      setEntries(allEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const allProjects = await window.projectsAPI.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleStartTimer = async (taskName: string) => {
    try {
      await window.timerAPI.startTimer(taskName);
      await loadEntries(); // Refresh the list
      props.onEntryUpdate?.(); // Notify parent about the change
    } catch (error) {
      console.error('Error starting timer:', error);
      alert('Failed to start timer');
    }
  };

  // Selection handlers
  const handleToggleSelection = (entryId: number) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleDeselectAll = () => {
    setSelectedTaskIds(new Set<number>());
  };

  // Get selected entries for summary
  const selectedEntries = createMemo(() => {
    const selected = selectedTaskIds();
    return entries().filter(entry => selected.has(entry.id));
  });

  // Handle logged status toggle
  const handleToggleLogged = async (entryId: number) => {
    try {
      const entry = entries().find(e => e.id === entryId);
      if (!entry) return;
      
      const success = await window.entriesAPI.updateEntry(entryId, { logged: !entry.logged });
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.();
      } else {
        alert('Failed to update logged status');
      }
    } catch (error) {
      console.error('Error updating logged status:', error);
      alert('Failed to update logged status');
    }
  };


  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      // For other days, show full weekday and date
      return date.toLocaleDateString([], { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Get the start of the week (Sunday) for a given date
  const getWeekStart = (date: Date): Date => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Sunday = 0
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Get the end of the week (Saturday) for a given date
  const getWeekEnd = (date: Date): Date => {
    const end = new Date(date);
    end.setDate(end.getDate() - end.getDay() + 6); // Saturday
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // Format week label ("this week", "last week", or date range)
  const formatWeekLabel = (weekStart: Date, weekEnd: Date): string => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    if (weekStart.getTime() === thisWeekStart.getTime()) {
      return 'This week';
    } else if (weekStart.getTime() === lastWeekStart.getTime()) {
      return 'Last week';
    } else {
      // Format as "Aug 10 - Aug 16" or "Aug 25 - Sep 1" for cross-month
      const startStr = weekStart.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric'
      });
      const endStr = weekEnd.toLocaleDateString([], {
        month: weekStart.getMonth() === weekEnd.getMonth() ? undefined : 'short',
        day: 'numeric'
      });
      return `${startStr} - ${endStr}`;
    }
  };


  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry.id);
    setEditValues({
      taskName: entry.taskName,
      project: entry.project,
      startTime: formatDateTimeForInput(entry.startTime),
      endTime: entry.endTime ? formatDateTimeForInput(entry.endTime) : ''
    });
  };

  const cancelEditing = () => {
    setEditingEntry(null);
    setEditValues({ taskName: '', project: null, startTime: '', endTime: '' });
  };

  const saveEntry = async (entryId: number) => {
    const values = editValues();

    try {
      const updates: any = {};

      if (values.taskName.trim()) {
        updates.taskName = values.taskName.trim();
      }

      // Always include project in updates (can be null for "No project")
      updates.project = values.project;

      if (values.startTime) {
        updates.startTime = parseInputDateTime(values.startTime);
      }

      if (values.endTime) {
        updates.endTime = parseInputDateTime(values.endTime);
      } else {
        // If endTime is cleared, set it to null (for active timers)
        updates.endTime = null;
      }

      // Validate that end time is not before start time (same time is allowed)
      if (updates.endTime && updates.startTime && updates.endTime < updates.startTime) {
        alert('End time cannot be before start time');
        return;
      }

      const success = await window.entriesAPI.updateEntry(entryId, updates);
      if (success) {
        await loadEntries();
        await loadProjects(); // Reload projects in case a new one was added
        props.onEntryUpdate?.();
        cancelEditing();
      } else {
        alert('Failed to update entry');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry');
    }
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      // Check if the entry being deleted is currently running
      const entryToDelete = entries().find(entry => entry.id === id);
      const isRunningTimer = entryToDelete && !entryToDelete.endTime;

      // If it's a running timer, stop it first
      if (isRunningTimer) {
        try {
          await window.timerAPI.stopTimer(id);
        } catch (stopError) {
          console.error('Error stopping timer before deletion:', stopError);
          // Continue with deletion even if stop fails
        }
      }

      const success = await window.entriesAPI.deleteEntry(id);
      if (success) {
        await loadEntries();
        props.onEntryUpdate?.(); // This will trigger timer state refresh
      } else {
        alert('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  // Project handlers
  // Open the project modal specifically from the History view dropdown
  const openProjectModalFromView = () => {
    setProjectModalMode('create');
    setProjectToRename(undefined);
    setProjectModalSource('view');
    setShowProjectModal(true);
  };

  // Open the project modal from within the task edit UI
  const openProjectModalFromEdit = () => {
    setProjectModalMode('create');
    setProjectToRename(undefined);
    setProjectModalSource('edit');
    setShowProjectModal(true);
  };

  const handleRenameProject = (project: string) => {
    setProjectModalMode('rename');
    setProjectToRename(project);
    setProjectModalSource('view');
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (project: string) => {
    try {
      await window.projectsAPI.deleteProject(project);
      await loadProjects();
      await loadEntries();
      // If we deleted the currently selected project, switch to "All projects"
      if (props.selectedProject === project) {
        props.onProjectChange(undefined);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const handleProjectModalConfirm = async (name: string) => {
    try {
      if (projectModalMode() === 'create') {
        // Persist the project so it exists even if there are no entries yet
        await window.projectsAPI.createProject(name);
        await loadProjects();

        if (projectModalSource() === 'view') {
          // Opened from the History view dropdown:
          // - switch the active filter to the new project
          // - Timer will start new entries under this project
          props.onProjectChange(name);
        } else {
          // Opened from the task edit modal:
          // - do NOT change the current view
          // - update the editing form so the task will be saved under this project
          setEditValues((current) => ({
            ...current,
            project: name,
          }));
        }

        setShowProjectModal(false);
      } else {
        // For rename, update all entries with the old project name
        const oldName = projectToRename();
        if (oldName) {
          await window.projectsAPI.renameProject(oldName, name);
          await loadProjects();
          await loadEntries();
          // Update selected project if we renamed the currently selected one
          if (props.selectedProject === oldName) {
            props.onProjectChange(name);
          }
        }
        setShowProjectModal(false);
      }
    } catch (error) {
      console.error('Error with project operation:', error);
      alert('Failed to process project operation');
    }
  };

  // Group entries by week and day, calculate totals
  const groupedByWeeks = (): WeeklyGroup[] => {
    const weekGroups: WeeklyGroup[] = [];
    const entriesList = entries();

    // First group by week (purely structural, independent of currentTime)
    entriesList.forEach(entry => {
      const entryDate = new Date(entry.startTime);
      const weekStart = getWeekStart(entryDate);
      const weekEnd = getWeekEnd(entryDate);
      const weekKey = weekStart.toDateString();
      
      let weekGroup = weekGroups.find(w => w.weekStart.toDateString() === weekKey);
      
      if (!weekGroup) {
        weekGroup = {
          weekLabel: formatWeekLabel(weekStart, weekEnd),
          weekStart,
          weekEnd,
          days: []
        };
        weekGroups.push(weekGroup);
      }

      // Now group by day within the week
      const dateStr = formatDate(entry.startTime);
      let dayGroup = weekGroup.days.find(d => d.date === dateStr);
      
      if (!dayGroup) {
        dayGroup = { date: dateStr, entries: [] };
        weekGroup.days.push(dayGroup);
      }
      
      dayGroup.entries.push(entry);
    });

    // Sort days within week (most recent first)
    weekGroups.forEach(weekGroup => {
      weekGroup.days.sort((a, b) => {
        if (a.date === 'Today') return -1;
        if (b.date === 'Today') return 1;
        if (a.date === 'Yesterday') return -1;
        if (b.date === 'Yesterday') return 1;
        return new Date(b.entries[0]?.startTime || 0).getTime() - new Date(a.entries[0]?.startTime || 0).getTime();
      });
    });

    // Sort weeks (most recent first)
    weekGroups.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

    return weekGroups;
  };


  return (
    <div class="h-full flex flex-col bg-base-100" data-testid="time-list">
      {/* Header with overall summary */}
      <div class="p-2 border-b border-base-300" data-testid="time-list-header">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold">History</div>
            {entries().length > 0 && (
              <div class="text-sm text-base-content/70" data-testid="time-list-entry-count">
                {entries().length}
              </div>
            )}
          </div>
          <ProjectDropdown
            projects={projects()}
            selectedProject={props.selectedProject}
            onSelectProject={props.onProjectChange}
            onAddProject={openProjectModalFromView}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            showAllProjects={true}
          />
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center py-6" data-testid="time-list-loading">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span class="text-sm">Loading...</span>
        </div>
      </Show>

      <Show when={!loading() && entries().length === 0}>
        <div class="text-center py-8 text-base-content/50" data-testid="time-list-empty">
          <div class="text-sm">No time entries yet</div>
          <div class="text-xs mt-1">Start a timer to create your first entry</div>
        </div>
      </Show>

      <Show when={!loading() && entries().length > 0}>
        <div class="flex-1 overflow-y-auto min-h-0" data-testid="time-list-content">
          <For each={groupedByWeeks()}>
            {(week) => (
              <WeeklySummary
                week={week}
                editingEntry={editingEntry()}
                editValues={editValues()}
                onEdit={startEditing}
                onDelete={deleteEntry}
                onStartTimer={handleStartTimer}
                onEditValuesChange={setEditValues}
                onSave={saveEntry}
                onCancel={cancelEditing}
                currentTime={currentTime()}
                selectedTaskIds={selectedTaskIds()}
                onToggleSelection={handleToggleSelection}
                onToggleLogged={handleToggleLogged}
                projects={projects()}
                onAddProject={openProjectModalFromEdit}
              />
            )}
          </For>
        </div>
      </Show>

      <SelectionSummary
        selectedEntries={selectedEntries()}
        onDeselectAll={handleDeselectAll}
        currentTime={currentTime()}
      />

      <ProjectModal
        show={showProjectModal()}
        mode={projectModalMode()}
        currentName={projectToRename()}
        existingProjects={projects()}
        onConfirm={handleProjectModalConfirm}
        onCancel={() => setShowProjectModal(false)}
      />
    </div>
  );
};

export default TimeList;