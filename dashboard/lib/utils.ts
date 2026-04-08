/**
 * Shared utility functions for the AI Engineering Dashboard.
 */

/**
 * Returns a human-readable relative time string (e.g., "3m ago", "2h ago").
 */
export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Formats a timestamp as a localized date string (e.g., "Apr 5, 2026").
 */
export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a timestamp as a localized time string (e.g., "2:30:45 PM").
 */
export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formats a duration in milliseconds as "Xm Ys" or "Xh Ym".
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

/**
 * Truncates a string to the given length, appending "..." if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/**
 * Creates a debounced version of a function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Joins CSS class names, filtering out falsy values.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Converts a GitHub username (e.g. "haozhan_microsoft") to a Teams email ("haozhan@microsoft.com").
 */
export function githubToTeamsEmail(username: string): string {
  return username.replace(/_microsoft$/, '') + '@microsoft.com';
}

/**
 * Builds a Microsoft Teams deep link that opens a chat with the given email
 * and pre-fills a review request message.
 */
export function buildTeamsPingUrl(email: string, pr: { number: number; title: string; url: string }): string {
  const msg = `Hi, could you please review my PR #${pr.number}: ${pr.title}\n${pr.url}`;
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}&message=${encodeURIComponent(msg)}`;
}
