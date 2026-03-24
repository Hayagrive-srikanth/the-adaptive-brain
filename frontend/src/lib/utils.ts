/**
 * Get time-based greeting
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculate days remaining until a date
 */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format minutes to a readable duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get color class based on readiness score
 */
export function getReadinessColor(score: number): string {
  if (score < 30) return 'text-red-500';
  if (score < 60) return 'text-orange-500';
  if (score < 80) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Get bg color class based on readiness score
 */
export function getReadinessBgColor(score: number): string {
  if (score < 30) return 'bg-red-500';
  if (score < 60) return 'bg-orange-500';
  if (score < 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Get difficulty badge color
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'foundational': return 'bg-green-100 text-green-700';
    case 'intermediate': return 'bg-yellow-100 text-yellow-700';
    case 'advanced': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
