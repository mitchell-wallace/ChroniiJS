import { Component, createSignal, createEffect } from 'solid-js';
import type { TimeEntry } from '../types/electron';

interface SummaryProps {
  refreshTrigger?: number;
}

const Summary: Component<SummaryProps> = (props) => {
  const [todayTotal, setTodayTotal] = createSignal(0);
  const [weekTotal, setWeekTotal] = createSignal(0);
  const [monthTotal, setMonthTotal] = createSignal(0);
  const [loading, setLoading] = createSignal(true);

  // Load summary data on component mount and when refresh trigger changes
  createEffect(async () => {
    await loadSummaryData();
  });

  createEffect(async () => {
    if (props.refreshTrigger !== undefined) {
      await loadSummaryData();
    }
  });

  const loadSummaryData = async () => {
    try {
      setLoading(true);
      
      // Get current date boundaries
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
      
      // Start of week (Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Start of month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      
      // Get all entries for calculations
      const allEntries = await window.entriesAPI.getAllEntries(1000); // Get a large number
      
      // Calculate today's total
      const todayEntries = allEntries.filter(entry => 
        entry.startTime >= startOfToday && entry.startTime <= endOfToday
      );
      const todayDuration = calculateTotalDuration(todayEntries);
      setTodayTotal(todayDuration);
      
      // Calculate week's total
      const weekEntries = allEntries.filter(entry => 
        entry.startTime >= startOfWeek.getTime()
      );
      const weekDuration = calculateTotalDuration(weekEntries);
      setWeekTotal(weekDuration);
      
      // Calculate month's total
      const monthEntries = allEntries.filter(entry => 
        entry.startTime >= startOfMonth
      );
      const monthDuration = calculateTotalDuration(monthEntries);
      setMonthTotal(monthDuration);
      
    } catch (error) {
      console.error('Error loading summary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalDuration = (entries: TimeEntry[]): number => {
    return entries.reduce((total, entry) => {
      const endTime = entry.endTime || Date.now(); // Use current time for running timers
      return total + (endTime - entry.startTime);
    }, 0);
  };

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDetailedDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div class="card bg-base-200 shadow-lg p-6">
      <h2 class="card-title text-xl mb-4">Summary</h2>
      
      {loading() ? (
        <div class="flex items-center justify-center py-4">
          <span class="loading loading-spinner loading-sm mr-2"></span>
          <span class="text-sm">Calculating...</span>
        </div>
      ) : (
        <div class="grid grid-cols-1 gap-4">
          {/* Today */}
          <div class="stat bg-base-100 rounded-lg p-4">
            <div class="stat-figure text-primary">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div class="stat-title">Today</div>
            <div class="stat-value text-2xl text-primary">{formatDuration(todayTotal())}</div>
            <div class="stat-desc text-xs font-mono">{formatDetailedDuration(todayTotal())}</div>
          </div>

          {/* This Week */}
          <div class="stat bg-base-100 rounded-lg p-4">
            <div class="stat-figure text-secondary">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="stat-title">This Week</div>
            <div class="stat-value text-2xl text-secondary">{formatDuration(weekTotal())}</div>
            <div class="stat-desc text-xs font-mono">{formatDetailedDuration(weekTotal())}</div>
          </div>

          {/* This Month */}
          <div class="stat bg-base-100 rounded-lg p-4">
            <div class="stat-figure text-accent">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div class="stat-title">This Month</div>
            <div class="stat-value text-2xl text-accent">{formatDuration(monthTotal())}</div>
            <div class="stat-desc text-xs font-mono">{formatDetailedDuration(monthTotal())}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Summary;