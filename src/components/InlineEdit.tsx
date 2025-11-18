import { Component, createSignal, createEffect } from 'solid-js';

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  class?: string;
  readOnlyClass?: string;
  editClass?: string;
  disabled?: boolean;
  maxLength?: number;
  'data-testid'?: string;
  forceEditTrigger?: number; // When this changes, force editing mode
}

const InlineEdit: Component<InlineEditProps> = (props) => {
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal(props.value);
  let inputRef: HTMLInputElement | undefined;

  // Update edit value when props.value changes (external updates)
  createEffect(() => {
    if (!isEditing()) {
      setEditValue(props.value);
    }
  });

  // Force editing mode when forceEditTrigger changes
  createEffect(() => {
    if (props.forceEditTrigger !== undefined && props.forceEditTrigger > 0) {
      startEdit();
    }
  });

  const startEdit = () => {
    if (props.disabled) return;
    
    setEditValue(props.value);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const newValue = editValue().trim();
    if (newValue && newValue !== props.value) {
      props.onSave(newValue);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditValue(props.value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleBlur = () => {
    saveEdit();
  };

  // Focus input when editing starts
  createEffect(() => {
    if (isEditing() && inputRef) {
      inputRef.focus();
      inputRef.select();
    }
  });

  return (
    <>
      {isEditing() ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue()}
          onInput={(e) => setEditValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={props.placeholder}
          maxLength={props.maxLength}
          class={`${props.editClass || 'input input-sm input-bordered'} ${props.class || ''}`}
          data-testid={props['data-testid'] ? `${props['data-testid']}-input` : undefined}
        />
      ) : (
        <div
          class={`cursor-pointer ${props.readOnlyClass || 'hover:bg-base-200 hover:rounded px-1 -mx-1'} ${props.class || ''}`}
          onClick={startEdit}
          title={props.disabled ? undefined : "Click to edit"}
          data-testid={props['data-testid'] ? `${props['data-testid']}-display` : undefined}
        >
          {props.value || (
            <span class="text-base-content/40 italic">
              {props.placeholder || 'Click to edit'}
            </span>
          )}
        </div>
      )}
    </>
  );
};

export default InlineEdit;
