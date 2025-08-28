import { Component, Show, createEffect, onCleanup } from 'solid-js';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: string;
  danger?: boolean;
}

interface ContextMenuProps {
  show: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: Component<ContextMenuProps> = (props) => {
  let menuRef: HTMLDivElement | undefined;

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef && !menuRef.contains(event.target as Node)) {
      props.onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      props.onClose();
    }
  };

  // Set up event listeners when menu is shown
  createEffect(() => {
    if (props.show) {
      // Add listeners after a short delay to avoid immediate closure from the context menu trigger
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={props.show}>
      <div
        ref={menuRef}
        class="fixed z-50 bg-base-100 border border-base-300 shadow-lg min-w-32"
        style={{
          left: `${props.x}px`,
          top: `${props.y}px`,
        }}
      >
        <div class="py-1">
          {props.items.map((item) => (
            <button
              class={`w-full text-left px-3 py-2 text-sm hover:bg-base-200 flex items-center gap-2 ${
                item.danger ? 'text-error' : ''
              }`}
              onClick={() => {
                item.onClick();
                props.onClose();
              }}
            >
              {item.icon && (
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                </svg>
              )}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </Show>
  );
};

export default ContextMenu;