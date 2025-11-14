import { Component, JSX } from 'solid-js';
import WebTitleBar from './WebTitleBar';

interface WebWrapperProps {
  children: JSX.Element;
}

const WebWrapper: Component<WebWrapperProps> = (props) => {
  return (
    <div class="min-h-screen bg-base-100 flex flex-col">
      {/* Full-width header */}
      <WebTitleBar />
      
      {/* Centered content with max-width ~800px and subtle shadow */}
      <div class="flex-1 flex justify-center bg-base-100">
        <div class="w-full max-w-3xl shadow-lg flex flex-col">
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default WebWrapper;
