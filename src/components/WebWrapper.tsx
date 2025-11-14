import { Component, JSX } from 'solid-js';
import WebTitleBar from './WebTitleBar';

interface WebWrapperProps {
  children: JSX.Element;
}

const WebWrapper: Component<WebWrapperProps> = (props) => {
  return (
    <div class="min-h-screen bg-base-300 flex justify-center">
      <div class="w-full max-w-[1200px] bg-base-100 shadow-2xl flex flex-col min-h-screen">
        <WebTitleBar />
        <div class="flex-1 flex flex-col">
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default WebWrapper;
