import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';

export type MenuItem = {
  label: string;
  action: string;
  shortcut?: string;
} | {
  type: 'separator';
};

export interface AppMenuProps {
  isOpen: boolean;
  onMenuItemClick: (action: string) => void;
  onClose: () => void;
}

const AppMenu: Component<AppMenuProps> = (props) => {
  const fileMenuItems: MenuItem[] = [
    { label: 'New Task', action: 'new-task', shortcut: 'Ctrl+N' },
    { type: 'separator' as const },
    { label: 'Exit', action: 'exit', shortcut: 'Alt+F4' }
  ];

  const viewMenuItems: MenuItem[] = [
    { label: 'Reload', action: 'view:reload', shortcut: 'Ctrl+R' },
    { label: 'Force Reload', action: 'view:force-reload', shortcut: 'Ctrl+Shift+R' },
    { type: 'separator' as const },
    { label: 'Zoom In', action: 'view:zoom-in', shortcut: 'Ctrl+Plus' },
    { label: 'Zoom Out', action: 'view:zoom-out', shortcut: 'Ctrl+-' },
    { label: 'Reset Zoom', action: 'view:zoom-reset', shortcut: 'Ctrl+0' },
    { type: 'separator' as const },
    { label: 'Developer Tools', action: 'view:dev-tools', shortcut: 'F12' }
  ];

  const handleOutsideClick = (e: Event) => {
    // Only close if clicking outside the menu
    e.preventDefault();
    props.onClose();
  };

  // Setup event listeners
  createEffect(() => {
    if (props.isOpen) {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('contextmenu', handleOutsideClick);
    }

    onCleanup(() => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('contextmenu', handleOutsideClick);
    });
  });

  return (
    <>
      {/* App Menu Dropdown */}
      {props.isOpen && (
        <div class="absolute top-8 left-3 bg-base-100 border border-base-300 rounded shadow-lg py-1 z-50 min-w-48">
          {/* File Menu Section */}
          <div class="px-2 py-1 text-xs font-semibold text-base-content/60 uppercase tracking-wide">File</div>
          {fileMenuItems.map((item) => {
            if ('type' in item && item.type === 'separator') {
              return <hr class="my-1 border-base-300" />;
            }
            // Type assertion for non-separator items
            const menuItem = item as { label: string; action: string; shortcut?: string };
            return (
              <button
                class="w-full text-left px-4 py-1 hover:bg-base-200 transition-colors block flex items-center justify-between"
                onClick={() => {
                  props.onMenuItemClick(menuItem.action);
                  props.onClose();
                }}
              >
                <span>{menuItem.label}</span>
                {menuItem.shortcut && <span class="text-xs text-base-content/60 ml-2">{menuItem.shortcut}</span>}
              </button>
            );
          })}
          
          {/* View Menu Section */}
          <hr class="my-1 border-base-300" />
          <div class="px-2 py-1 text-xs font-semibold text-base-content/60 uppercase tracking-wide">View</div>
          {viewMenuItems.map((item) => {
            if ('type' in item && item.type === 'separator') {
              return <hr class="my-1 border-base-300" />;
            }
            // Type assertion for non-separator items
            const menuItem = item as { label: string; action: string; shortcut?: string };
            return (
              <button
                class="w-full text-left px-4 py-1 hover:bg-base-200 transition-colors block flex items-center justify-between"
                onClick={() => {
                  props.onMenuItemClick(menuItem.action);
                  props.onClose();
                }}
              >
                <span>{menuItem.label}</span>
                {menuItem.shortcut && <span class="text-xs text-base-content/60 ml-2">{menuItem.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AppMenu;