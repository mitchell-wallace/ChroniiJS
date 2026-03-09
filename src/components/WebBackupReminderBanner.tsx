import {
	type Component,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';

import type { ReminderBackupFormat } from '../shared/api-types';

type ReminderConfig = {
	enabled: boolean;
	dayOfWeek: number;
	format: ReminderBackupFormat;
	lastDismissed: string | null;
};

const DEFAULT_REMINDER: ReminderConfig = {
	enabled: false,
	dayOfWeek: 5,
	format: 'db',
	lastDismissed: null,
};

const formatDateKey = (date: Date) => {
	const pad = (value: number) => value.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const WebBackupReminderBanner: Component = () => {
	const [reminder, setReminder] =
		createSignal<ReminderConfig>(DEFAULT_REMINDER);
	const [isVisible, setIsVisible] = createSignal(false);

	const updateVisibility = (next: ReminderConfig) => {
		const today = new Date();
		const todayKey = formatDateKey(today);
		const isReminderDay = today.getDay() === next.dayOfWeek;
		const dismissedToday = next.lastDismissed === todayKey;
		setIsVisible(next.enabled && isReminderDay && !dismissedToday);
	};

	const loadConfig = async () => {
		try {
			const config = await window.configAPI.getConfig();
			const nextReminder = config?.backup?.reminders ?? DEFAULT_REMINDER;
			setReminder(nextReminder);
			updateVisibility(nextReminder);
		} catch (error) {
			console.error('Failed to load reminder config:', error);
		}
	};

	onMount(() => {
		loadConfig();
		const handleConfigUpdate = () => loadConfig();
		window.addEventListener('chronii:config-updated', handleConfigUpdate);
		onCleanup(() =>
			window.removeEventListener('chronii:config-updated', handleConfigUpdate),
		);
	});

	const dismissReminder = async () => {
		const todayKey = formatDateKey(new Date());
		const nextReminder = { ...reminder(), lastDismissed: todayKey };
		setReminder(nextReminder);
		updateVisibility(nextReminder);
		await window.configAPI.updateConfig({
			backup: {
				reminders: nextReminder,
			},
		});
	};

	const handleDownload = async () => {
		try {
			if (reminder().format === 'csv') {
				await window.databaseAPI.exportCsv();
			} else {
				await window.databaseAPI.exportDatabase();
			}
		} catch (error) {
			console.error('Failed to download backup:', error);
		}
	};

	return (
		<Show when={isVisible()}>
			<div class="fixed top-14 left-1/2 -translate-x-1/2 z-40">
				<div class="bg-base-100 border border-base-300 shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
					<div class="text-sm">
						Backup reminder: download your {reminder().format.toUpperCase()}{' '}
						backup today.
					</div>
					<button
						type="button"
						class="btn btn-xs btn-primary"
						onClick={handleDownload}
						title="Download a backup"
					>
						Download backup
					</button>
					<button
						type="button"
						class="btn btn-xs btn-ghost"
						onClick={dismissReminder}
						title="Dismiss reminder"
					>
						Dismiss
					</button>
				</div>
			</div>
		</Show>
	);
};

export default WebBackupReminderBanner;
