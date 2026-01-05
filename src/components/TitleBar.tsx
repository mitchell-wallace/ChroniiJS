import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import AppMenu from './AppMenu';

const TitleBar: Component = () => {
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [isDarkMode, setIsDarkMode] = createSignal(false);

  const checkDarkMode = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeAttr = document.documentElement.getAttribute('data-theme');
    setIsDarkMode(prefersDark || themeAttr === 'chronii-dark');
  };

  onMount(async () => {
    const maximized = await window.windowAPI.isMaximized();
    setIsMaximized(maximized);
    
    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => checkDarkMode();
    mediaQuery.addEventListener('change', handleChange);
    
    // Watch for data-theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    });
  });

  const handleMinimize = async () => {
    await window.windowAPI.minimize();
  };

  const handleMaximize = async () => {
    await window.windowAPI.maximize();
    const maximized = await window.windowAPI.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = async () => {
    await window.windowAPI.close();
  };

  const handleTitleClick = () => {
    setIsMenuOpen(!isMenuOpen());
  };


  const handleMenuItemClick = async (action: string) => {
    // Handle menu item clicks
    switch (action) {
      case 'new-task':
        console.log('New Task clicked');
        break;
      case 'export-data':
        console.log('Export Data clicked');
        break;
      case 'exit':
        handleClose();
        break;
      // View actions
      case 'view:reload':
        await window.viewAPI.reload();
        break;
      case 'view:force-reload':
        await window.viewAPI.forceReload();
        break;
      case 'view:dev-tools':
        await window.viewAPI.openDevTools();
        break;
      case 'view:zoom-in':
        await window.viewAPI.zoomIn();
        break;
      case 'view:zoom-out':
        await window.viewAPI.zoomOut();
        break;
      case 'view:zoom-reset':
        await window.viewAPI.zoomReset();
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  };

  return (
    <div class="flex items-center justify-between h-8 bg-base-100 border-b border-base-300 select-none relative backdrop-blur-sm">
      {/* Left side: Logotype with drag area */}
      <div class="flex items-center px-2 flex-1" style="-webkit-app-region: drag">
        <button
          class="flex items-center px-1 py-0 rounded transition-colors duration-150 relative hover:bg-base-200"
          onClick={handleTitleClick}
          style="-webkit-app-region: no-drag"
        >
          <img
            src={isDarkMode() ? "/chronii-logotype-dbg.svg" : "/chronii-logotype.svg"}
            alt="Chronii"
            class="h-4"
          />
        </button>
      </div>

      {/* App Menu Dropdown */}
      <AppMenu
        isOpen={isMenuOpen()}
        onClose={() => setIsMenuOpen(false)}
        onMenuItemClick={handleMenuItemClick}
      />

      {/* Right side: Window Controls */}
      <div class="flex" style="-webkit-app-region: no-drag">
        {/* Minimize Button */}
        <button
          class="w-12 h-8 flex items-center justify-center hover:bg-base-200 transition-colors duration-150"
          onClick={handleMinimize}
          title="Minimize"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            class="text-base-content/70"
            fill="currentColor"
          >
            <rect x="0" y="4" width="10" height="1" />
          </svg>
        </button>

        {/* Maximize/Restore Button */}
        <button
          class="w-12 h-8 flex items-center justify-center hover:bg-base-200 transition-colors duration-150"
          onClick={handleMaximize}
          title={isMaximized() ? "Restore Down" : "Maximize"}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            class="text-base-content/70"
            fill="currentColor"
          >
            {isMaximized() ? (
              // Restore icon (two overlapping squares - back window top-right, front window bottom-left)
              <>
                <rect x="3" y="1" width="6" height="6" stroke="currentColor" stroke-width="1" fill="none" />
                <rect x="1" y="3" width="6" height="6" stroke="currentColor" stroke-width="1" fill="white" />
              </>
            ) : (
              // Maximize icon (single square)
              <rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none" />
            )}
          </svg>
        </button>

        {/* Close Button */}
        <button
          class="w-12 h-8 flex items-center justify-center hover:bg-error hover:text-error-content transition-colors duration-150"
          onClick={handleClose}
          title="Close"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            class="text-base-content/70 hover:text-error-content"
            fill="currentColor"
          >
            <path d="M0.5,0.5 L9.5,9.5 M9.5,0.5 L0.5,9.5" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TitleBar;