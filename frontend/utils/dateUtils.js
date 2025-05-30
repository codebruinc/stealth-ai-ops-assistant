import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

/**
 * Format a date for display in the UI
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  
  if (isToday(dateObj)) {
    return `Today at ${format(dateObj, 'h:mm a')}`;
  } else if (isYesterday(dateObj)) {
    return `Yesterday at ${format(dateObj, 'h:mm a')}`;
  } else {
    return format(dateObj, 'MMM d, yyyy h:mm a');
  }
};

/**
 * Format a date as a relative time (e.g., "2 hours ago")
 * @param {string|Date} date - The date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  return formatDistanceToNow(dateObj, { addSuffix: true });
};

/**
 * Format a date for API requests
 * @param {string|Date} date - The date to format
 * @returns {string} ISO formatted date string
 */
export const formatForApi = (date) => {
  if (!date) return '';
  
  const dateObj = new Date(date);
  return dateObj.toISOString();
};