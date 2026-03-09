import { type Component, createSignal, onCleanup, onMount } from 'solid-js';
import DatabaseSettings from './DatabaseSettings';

const WebTitleBar: Component = () => {
	const [isDarkMode, setIsDarkMode] = createSignal(false);
	const [showDbSettings, setShowDbSettings] = createSignal(false);
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

	onMount(() => {
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

	return (
		<>
			<div class="w-full bg-base-200 border-b border-base-300 px-3 py-1.5 flex items-center justify-between flex-shrink-0 z-50">
				<div class="flex items-center gap-2">
					<img src={logotypeSrc()} alt="Chronii" class="h-6" />
					<span class="text-xs text-base-content/60 ml-1 mt-2">
						Web Edition
					</span>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="text-xs hover:bg-base-300 px-2 py-1 rounded transition-colors cursor-pointer"
						onClick={() => setShowDbSettings(true)}
					>
						Database settings
					</button>
				</div>
			</div>

			<DatabaseSettings
				isOpen={showDbSettings()}
				onClose={() => setShowDbSettings(false)}
			/>
		</>
	);
};

export default WebTitleBar;
