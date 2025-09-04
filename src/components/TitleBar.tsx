import { Component, createSignal, onMount } from 'solid-js';
import AppMenu from './AppMenu';

const TitleBar: Component = () => {
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  onMount(async () => {
    const maximized = await window.windowAPI.isMaximized();
    setIsMaximized(maximized);
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
    <div class="flex items-center justify-between h-8 bg-base-100 border-b border-base-300 select-none relative">
      {/* Left side: Logo and App Name with drag area */}
      <div class="flex items-center gap-2 px-3 flex-1" style="-webkit-app-region: drag">
        {/* Logo */}
        <div class="w-4 h-4 flex-shrink-0">
          <svg
            viewBox="400 343 1260 1360"
            width="16"
            height="16"
            class="w-full h-full"
          >
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#230885;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#3b25c2;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#6b70fd;stop-opacity:1" />
              </linearGradient>
            </defs>
            <path
              fill="url(#logoGradient)"
              d="M 1008.1 343.486 C 1078.25 342.635 1144.43 343.626 1213.6 358.504 C 1358.58 389.684 1492.04 470.559 1573.36 596.671 C 1594.23 629.047 1650.52 740.759 1642.51 777.618 C 1626.88 783.572 1608.53 785.738 1592.13 788.968 C 1561.49 795.068 1530.79 800.911 1500.04 806.494 L 1286.63 847.415 C 1279.48 833.993 1275.73 818.222 1269.6 804.222 C 1248.47 755.948 1214.43 713.295 1168.36 686.838 C 1112.31 654.649 1040.8 647.811 978.812 664.99 C 918.84 681.611 870.597 720.04 840.04 774.193 C 796.909 850.632 788.307 935.033 788.757 1021.35 C 789.04 1075.87 792.914 1127.67 807.724 1180.33 C 826.665 1247.68 867.188 1306.78 928.993 1341.27 C 985.37 1372.74 1056.55 1377.32 1117.94 1359.59 C 1187.79 1339.42 1239.65 1283.76 1268.69 1218.82 C 1276.01 1202.44 1280.39 1181.28 1288.81 1166.33 C 1289 1166 1289.2 1165.67 1289.4 1165.33 C 1311.64 1172.33 1335.12 1176.56 1357.83 1181.86 C 1404.92 1192.52 1451.9 1203.66 1498.77 1215.28 C 1516.49 1217.51 1535.19 1223.75 1552.7 1227.76 C 1584.53 1235.06 1623.53 1241.86 1653.8 1252.7 C 1637.35 1344.07 1590.76 1436.08 1529.8 1505.87 C 1416.28 1635.83 1263.63 1690.13 1095.01 1701.5 C 1053.92 1704.26 1008.03 1702.07 967.084 1697.58 C 836.32 1683.23 716.378 1640.49 616.31 1553.07 C 495.715 1447.72 430.982 1309.52 408.624 1152.41 C 404.287 1121.94 402.922 1090.59 400.936 1059.87 C 398.838 1027.42 399.907 994.107 401.993 961.694 C 403.465 938.818 404.616 915.836 407.933 893.136 C 425.906 770.147 476.938 643.121 559.567 549.221 C 680.995 411.23 827.892 355.125 1008.1 343.486 z"
            />
          </svg>
        </div>

        {/* App Name */}
        <button
          class="text-sm font-semibold text-base-content px-2 py-1 rounded transition-colors duration-150 relative hover:bg-base-200"
          onClick={handleTitleClick}
          style="-webkit-app-region: no-drag"
        >
          Chronii
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