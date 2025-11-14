import { Component, JSX } from 'solid-js';
import WebTitleBar from './WebTitleBar';

interface WebWrapperProps {
  children: JSX.Element;
}

const WebWrapper: Component<WebWrapperProps> = (props) => {
  return (
    <div class="min-h-screen bg-base-200/50 flex flex-col">
      {/* Full-width title bar */}
      <WebTitleBar />
      
      {/* Centered content column with white background, side borders and shadows */}
      <div class="flex-1 flex justify-center">
        <div class="w-full max-w-3xl bg-base-100 flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.2)] dark:shadow-[0_0_40px_rgba(80,80,80,0.15)] border-l-2 border-r-2 border-base-300 dark:border-base-200">
          {/* Spacing area */}
          <div class="h-8"></div>
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default WebWrapper;
