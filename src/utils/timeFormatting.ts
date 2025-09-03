/**
 * Time formatting utilities with seconds-level precision
 * Provides consistent time display across the ChroniiJS application
 */

/**
 * Formats a timestamp to display time without seconds
 * Used for displaying start/end times in task items
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "2:15 PM" or "14:15")
 */
export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit'
  });
};

/**
 * Formats a duration in milliseconds to display with seconds precision
 * Used for individual task duration display (not bold)
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 15m 30s", "15m 30s", "30s")
 */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Formats a duration for daily/weekly summaries, rounded to nearest minute
 * Used for summary totals that should be bold
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string rounded to minutes (e.g., "2h 15m", "15m")
 */
export const formatDurationSummary = (milliseconds: number): string => {
  const totalMinutes = Math.round(Math.max(0, milliseconds) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Formats a duration for the running timer display with colon notation
 * Used in the Timer component for real-time elapsed display
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted time string (e.g., "1:23:45", "23:45")
 */
export const formatTimerDisplay = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Formats a timestamp for datetime-local input with seconds precision
 * Used in editing forms to populate datetime-local inputs
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted datetime string for input (e.g., "2023-08-15T14:30:45")
 */
export const formatDateTimeForInput = (timestamp: number): string => {
  const date = new Date(timestamp);
  // Get local time components to avoid timezone offset issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Parses a datetime-local input string with seconds to timestamp
 * Used to convert edited datetime values back to timestamps
 * @param dateTimeString - Datetime string from input (with or without seconds)
 * @returns Unix timestamp in milliseconds
 */
export const parseInputDateTime = (dateTimeString: string): number => {
  // Handle both formats: with and without seconds
  // If no seconds provided, assume :00
  if (dateTimeString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
    dateTimeString += ':00';
  }
  
  // datetime-local input already represents local time, so this is correct
  return new Date(dateTimeString).getTime();
};