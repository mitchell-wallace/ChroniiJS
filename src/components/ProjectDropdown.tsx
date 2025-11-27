import { Component, createSignal, For, Show, onCleanup } from 'solid-js';

export interface ProjectDropdownProps {
  projects: string[];
  selectedProject: string | null | undefined;
  onSelectProject: (project: string | null | undefined) => void;
  onAddProject: () => void;
  onRenameProject: (project: string) => void;
  onDeleteProject: (project: string) => void;
  showAllProjects?: boolean;
}

const ProjectDropdown: Component<ProjectDropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [activeMenuProject, setActiveMenuProject] = createSignal<string | null>(null);
  let dropdownRef: HTMLDivElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    // Close the dropdown whenever a click occurs outside the overall dropdown
    // container. We don't need to special-case the context menu separately,
    // because it is rendered within the same dropdownRef tree.
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setIsOpen(false);
      setActiveMenuProject(null);
    }
  };

  const handleToggle = () => {
    const next = !isOpen();
    console.debug('[ProjectDropdown] toggle clicked, next isOpen =', next, 'projects =', props.projects, 'selectedProject =', props.selectedProject);
    setIsOpen(next);
    setActiveMenuProject(null);
  };

  const handleSelectProject = (project: string | null | undefined) => {
    props.onSelectProject(project);
    setIsOpen(false);
  };

  const handleDeleteProject = async (project: string) => {
    const count = await window.projectsAPI.getProjectCount(project);
    const message = `This cannot be undone, and all ${count} task${
      count !== 1 ? 's' : ''
    } will be deleted.`;

    if (confirm(`Delete project "${project}"?\n\n${message}`)) {
      props.onDeleteProject(project);
      setActiveMenuProject(null);
    }
  };

  const getDisplayName = () => {
    if (props.selectedProject === undefined) {
      return 'All projects';
    } else if (props.selectedProject === null) {
      return 'No project';
    } else {
      return props.selectedProject;
    }
  };

  const truncate = (text: string, maxLength: number = 20) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Add click outside listener
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  }

  return (
    <div class="relative" ref={dropdownRef} data-testid="project-dropdown">
      <button
        class="btn btn-sm btn-outline normal-case flex items-center gap-1 min-w-[120px]"
        onClick={handleToggle}
        data-testid="project-dropdown-button"
      >
        <span class="flex-1 text-left truncate text-base">
          {truncate(getDisplayName(), 18)}
        </span>
        <svg
          class="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div
          class="absolute right-0 mt-1 w-64 bg-base-100 rounded-lg shadow-lg border border-base-300 z-50"
          data-testid="project-dropdown-menu"
        >
          <div class="py-1 max-h-96 overflow-y-auto">
            {/* All projects option */}
            <Show when={props.showAllProjects}>
              <button
                class={`w-full text-left px-4 py-2 hover:bg-base-200 flex items-center justify-between ${
                  props.selectedProject === undefined ? 'bg-base-200' : ''
                }`}
                onClick={() => handleSelectProject(undefined)}
                data-testid="project-option-all"
              >
                <span class="text-base">All projects</span>
              </button>
            </Show>

            {/* No project option */}
            <button
              class={`w-full text-left px-4 py-2 hover:bg-base-200 flex items-center justify-between ${
                props.selectedProject === null ? 'bg-base-200' : ''
              }`}
              onClick={() => handleSelectProject(null)}
              data-testid="project-option-none"
            >
              <span class="text-base">No project</span>
            </button>

            {/* Project list */}
            <Show when={props.projects.length > 0}>
              <div class="border-t border-base-300 mt-1 pt-1">
                <For each={props.projects}>
                  {(project) => {
                    // Coerce to string defensively so we don't blow up if any
                    // legacy or unexpected values are present in the list.
                    const projectLabel = String(project);
                    const projectKey = projectLabel.toLowerCase().replace(/\s+/g, '-');

                    return (
                      <div class="relative group">
                        <button
                          class={`w-full text-left px-4 py-2 hover:bg-base-200 flex items-center justify-between ${
                            props.selectedProject === project ? 'bg-base-200' : ''
                          }`}
                          onClick={() => handleSelectProject(projectLabel)}
                          data-testid={`project-option-${projectKey}`}
                        >
                          <span class="text-base truncate pr-2">{truncate(projectLabel, 24)}</span>
                          <span
                            role="button"
                            tabindex={0}
                            class="btn btn-ghost btn-xs p-0 h-6 w-6 min-h-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuProject(activeMenuProject() === projectLabel ? null : projectLabel);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveMenuProject(activeMenuProject() === projectLabel ? null : projectLabel);
                              }
                            }}
                            data-testid={`project-menu-${projectKey}`}
                          >
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </span>
                        </button>

                        {/* Context menu for project */}
                        <Show when={activeMenuProject() === projectLabel}>
                          <div
                            ref={menuRef}
                            class="absolute right-8 top-0 bg-base-100 rounded-lg shadow-lg border border-base-300 z-50 min-w-[120px]"
                            data-testid={`project-context-menu-${projectKey}`}
                          >
                            <button
                              class="w-full text-left px-4 py-2 hover:bg-base-200 rounded-t-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                props.onRenameProject(projectLabel);
                                setActiveMenuProject(null);
                                setIsOpen(false);
                              }}
                              data-testid="project-rename-button"
                            >
                              Rename
                            </button>
                            <button
                              class="w-full text-left px-4 py-2 hover:bg-base-200 text-error rounded-b-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(projectLabel);
                              }}
                              data-testid="project-delete-button"
                            >
                              Delete
                            </button>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* Add project option */}
            <div class="border-t border-base-300 mt-1 pt-1">
              <button
                class="w-full text-left px-4 py-2 hover:bg-base-200 text-primary flex items-center gap-2"
                onClick={() => {
                  props.onAddProject();
                  setIsOpen(false);
                }}
                data-testid="project-add-button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span class="text-base">Add Project</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default ProjectDropdown;
