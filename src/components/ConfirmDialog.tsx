import { Component, Show, For } from 'solid-js';

export interface ConfirmDialogProps {
  show: boolean;
  title: string;
  message?: string;
  items?: string[];
  itemsMore?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  return (
    <Show when={props.show}>
      <div 
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={(e) => {
          // Close on backdrop click
          if (e.target === e.currentTarget) {
            props.onCancel();
          }
        }}
      >
        <div class="bg-base-100 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-bold mb-3">{props.title}</h3>
          
          <Show when={props.message}>
            <p class="mb-4 text-base-content/80">{props.message}</p>
          </Show>
          
          <Show when={props.items && props.items.length > 0}>
            <ul class="mb-4 text-sm text-base-content/70 space-y-1">
              <For each={props.items}>
                {(item) => (
                  <li class="truncate">• {item}</li>
                )}
              </For>
              <Show when={props.itemsMore && props.itemsMore > 0}>
                <li class="text-base-content/50 italic">...and {props.itemsMore} more</li>
              </Show>
            </ul>
          </Show>
          
          <div class="flex gap-3 justify-end">
            <button
              type="button"
              class="btn btn-sm"
              onClick={props.onCancel}
            >
              {props.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              class={`btn btn-sm ${props.confirmClass || 'btn-primary'}`}
              onClick={props.onConfirm}
            >
              {props.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ConfirmDialog;

