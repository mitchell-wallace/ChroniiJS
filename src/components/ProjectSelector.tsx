import { Component, createSignal, For, Show, onCleanup } from 'solid-js';

export interface ProjectSelectorProps {
  projects: string[];
  selectedProject: string | null;
  onSelectProject: (project: string | null) => void;
  onAddProject: () => void;
}

const ProjectSelector: Component<ProjectSelectorProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen());
  };

  const handleSelectProject = (project: string | null) => {
    props.onSelectProject(project);
    setIsOpen(false);
  };

  const getDisplayName = () => {
    return props.selectedProject === null ? 'No project' : props.selectedProject;
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
    <div class="relative w-full" ref={dropdownRef} data-testid="project-selector">
      <button
        class="btn btn-xs btn-outline normal-case flex items-center gap-1 w-full justify-between"
        onClick={handleToggle}
        data-testid="project-selector-button"
      >
        <span class="flex-1 text-left truncate text-xs">
          {truncate(getDisplayName(), 18)}
        </span>
        <svg
          class="w-3 h-3 flex-shrink-0"
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
          class="absolute left-0 mt-1 w-full bg-base-100 rounded-lg shadow-lg border border-base-300 z-50"
          data-testid="project-selector-menu"
        >
          <div class="py-1 max-h-48 overflow-y-auto">
            {/* No project option */}
            <button
              class={`w-full text-left px-3 py-1.5 hover:bg-base-200 text-xs ${
                props.selectedProject === null ? 'bg-base-200' : ''
              }`}
              onClick={() => handleSelectProject(null)}
              data-testid="project-selector-option-none"
            >
              No project
            </button>

            {/* Project list */}
            <Show when={props.projects.length > 0}>
              <div class="border-t border-base-300">
                <For each={props.projects}>
                  {(project) => (
                    <button
                      class={`w-full text-left px-3 py-1.5 hover:bg-base-200 text-xs truncate ${
                        props.selectedProject === project ? 'bg-base-200' : ''
                      }`}
                      onClick={() => handleSelectProject(project)}
                      data-testid={`project-selector-option-${project.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {truncate(project, 28)}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Add project option */}
            <div class="border-t border-base-300">
              <button
                class="w-full text-left px-3 py-1.5 hover:bg-base-200 text-primary flex items-center gap-2 text-xs"
                onClick={() => {
                  props.onAddProject();
                  setIsOpen(false);
                }}
                data-testid="project-selector-add-button"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Add Project</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default ProjectSelector;
