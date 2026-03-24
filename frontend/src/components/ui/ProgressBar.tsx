'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Custom bar color; defaults to primary blue-purple */
  color?: string;
  /** Show percentage label above the bar */
  showLabel?: boolean;
  /** Height of the bar in pixels */
  height?: number;
  className?: string;
}

export default function ProgressBar({
  value,
  color = '#6C63FF',
  showLabel = false,
  height = 12,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="mb-1.5 flex justify-between text-sm font-medium text-gray-600">
          <span>Progress</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}

      <div
        className="w-full overflow-hidden rounded-full bg-gray-200"
        style={{ height }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
