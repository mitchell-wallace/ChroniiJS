import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import AppMenu from './AppMenu';
import DatabaseSettings from './DatabaseSettings';

const TitleBar: Component = () => {
	const [isMaximized, setIsMaximized] = createSignal(false);
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isDarkMode, setIsDarkMode] = createSignal(false);
	const [isDbSettingsOpen, setIsDbSettingsOpen] = createSignal(false);
	const baseUrl = import.meta.env.BASE_URL || '/';
	const logotypeSrc = () =>
		`${baseUrl}${isDarkMode() ? 'chronii-logotype-dbg.svg' : 'chronii-logotype.svg'}`;

	const checkDarkMode = () => {
		const prefersDark = window.matchMedia(
			'(prefers-color-scheme: dark)',
		).matches;
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
			attributeFilter: ['data-theme'],
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
		<div class="flex items-center justify-between h-8 bg-base-100 border-b border-base-300 select-none relative backdrop-blur-sm z-10">
			{/* Left side: Logotype with drag area */}
			<div
				class="flex items-center px-2 flex-1"
				style="-webkit-app-region: drag"
			>
				<button
					type="button"
					class="flex items-center px-1 py-0 rounded transition-colors duration-150 relative hover:bg-base-200"
					onClick={handleTitleClick}
					style="-webkit-app-region: no-drag"
				>
					<img src={logotypeSrc()} alt="Chronii" class="h-4" />
					<svg
						aria-hidden="true"
						width="10"
						height="6"
						viewBox="0 0 10 6"
						class="ml-1 mt-1 text-base-content/70"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M1 1 L5 5 L9 1" />
					</svg>
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-6 h-6 ml-1 rounded transition-colors duration-150 hover:bg-base-200"
					onClick={() => setIsDbSettingsOpen(true)}
					style="-webkit-app-region: no-drag"
					title="Database Settings"
					data-testid="database-settings-button"
				>
					<svg
						aria-hidden="true"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						class="text-base-content/60"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="3" />
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
				</button>
			</div>

			{/* App Menu Dropdown */}
			<AppMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				onMenuItemClick={handleMenuItemClick}
			/>

			<Portal>
				<DatabaseSettings
					isOpen={isDbSettingsOpen()}
					onClose={() => setIsDbSettingsOpen(false)}
				/>
			</Portal>

			{/* Right side: Window Controls */}
			<div class="flex" style="-webkit-app-region: no-drag">
				{/* Minimize Button */}
				<button
					type="button"
					class="w-12 h-8 flex items-center justify-center hover:bg-base-200 transition-colors duration-150"
					onClick={handleMinimize}
					title="Minimize"
				>
					<svg
						aria-hidden="true"
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
					type="button"
					class="w-12 h-8 flex items-center justify-center hover:bg-base-200 transition-colors duration-150"
					onClick={handleMaximize}
					title={isMaximized() ? 'Restore Down' : 'Maximize'}
				>
					<svg
						aria-hidden="true"
						width="10"
						height="10"
						viewBox="0 0 10 10"
						class="text-base-content/70"
						fill="currentColor"
					>
						{isMaximized() ? (
							// Restore icon (two overlapping squares - back window top-right, front window bottom-left)
							<>
								<rect
									x="3"
									y="1"
									width="6"
									height="6"
									stroke="currentColor"
									stroke-width="1"
									fill="none"
								/>
								<rect
									x="1"
									y="3"
									width="6"
									height="6"
									stroke="currentColor"
									stroke-width="1"
									fill="white"
								/>
							</>
						) : (
							// Maximize icon (single square)
							<rect
								x="1"
								y="1"
								width="8"
								height="8"
								stroke="currentColor"
								stroke-width="1"
								fill="none"
							/>
						)}
					</svg>
				</button>

				{/* Close Button */}
				<button
					type="button"
					class="w-12 h-8 flex items-center justify-center hover:bg-error hover:text-error-content transition-colors duration-150"
					onClick={handleClose}
					title="Close"
				>
					<svg
						aria-hidden="true"
						width="10"
						height="10"
						viewBox="0 0 10 10"
						class="text-base-content/70 hover:text-error-content"
						fill="currentColor"
					>
						<path
							d="M0.5,0.5 L9.5,9.5 M9.5,0.5 L0.5,9.5"
							stroke="currentColor"
							stroke-width="1"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
};

export default TitleBar;
