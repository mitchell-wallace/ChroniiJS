import { Component, createSignal, Show, createEffect } from 'solid-js';

interface ProjectModalProps {
  show: boolean;
  mode: 'create' | 'rename';
  currentName?: string;
  existingProjects: string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const RESERVED_NAMES = ['all projects', 'no project'];

const ProjectModal: Component<ProjectModalProps> = (props) => {
  const [projectName, setProjectName] = createSignal(props.currentName || '');
  const [error, setError] = createSignal<string | null>(null);

  // Reset input state whenever the modal is shown or the currentName changes
  createEffect(() => {
    if (props.show) {
      setProjectName(props.currentName || '');
      setError(null);
    }
  });

  const validateProjectName = (name: string): string | null => {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return 'Project name cannot be empty';
    }

    // Check for reserved names (case-insensitive)
    if (RESERVED_NAMES.some(reserved => reserved.toLowerCase() === trimmedName.toLowerCase())) {
      return `"${trimmedName}" is a reserved name and cannot be used`;
    }

    // Check for duplicate names (case-insensitive), excluding current name when renaming
    const isDuplicate = props.existingProjects.some(
      existing =>
        existing.toLowerCase() === trimmedName.toLowerCase() &&
        (props.mode === 'create' || existing !== props.currentName)
    );

    if (isDuplicate) {
      return 'A project with this name already exists';
    }

    // Check for valid characters (SQLite TEXT should support most characters)
    // We'll keep it simple and allow most characters, but restrict null bytes
    if (trimmedName.includes('\0')) {
      return 'Project name contains invalid characters';
    }

    return null;
  };

  const handleConfirm = () => {
    const validationError = validateProjectName(projectName());

    if (validationError) {
      setError(validationError);
      return;
    }

    props.onConfirm(projectName().trim());
    setProjectName('');
    setError(null);
  };

  const handleCancel = () => {
    setProjectName(props.currentName || '');
    setError(null);
    props.onCancel();
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Show when={props.show}>
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleCancel}
        data-testid="project-modal-backdrop"
      >
        <div
          class="bg-base-100 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
          data-testid="project-modal"
        >
          <h2 class="text-lg font-semibold mb-4" data-testid="project-modal-title">
            {props.mode === 'create' ? 'Add Project' : 'Rename Project'}
          </h2>

          <div class="mb-4">
            <input
              type="text"
              class="input input-bordered w-full"
              placeholder="Project name"
              value={projectName()}
              onInput={(e) => {
                setProjectName(e.currentTarget.value);
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              autofocus
              data-testid="project-modal-input"
            />
            <Show when={error()}>
              <p class="text-error text-sm mt-2" data-testid="project-modal-error">
                {error()}
              </p>
            </Show>
          </div>

          <div class="flex justify-end gap-2">
            <button
              class="btn btn-ghost"
              onClick={handleCancel}
              data-testid="project-modal-cancel"
            >
              Cancel
            </button>
            <button
              class="btn btn-primary"
              onClick={handleConfirm}
              data-testid="project-modal-confirm"
            >
              {props.mode === 'create' ? 'Create' : 'Rename'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ProjectModal;
