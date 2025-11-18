import { Component } from 'solid-js';

interface HistoryHeaderProps {
  entryCount: number;
}

const HistoryHeader: Component<HistoryHeaderProps> = (props) => {
  return (
    <div class="p-2 border-b border-base-300 flex-shrink-0" data-testid="time-list-header">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold">History</div>
        {props.entryCount > 0 && (
          <div class="text-sm text-base-content/70" data-testid="time-list-entry-count">
            {props.entryCount} entries
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryHeader;
