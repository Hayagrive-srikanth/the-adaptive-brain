'use client';

import React from 'react';

/* -------------------------------------------------------------------------- */
/*  Spinner                                                                   */
/* -------------------------------------------------------------------------- */

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  className?: string;
}

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function Spinner({
  size = 'md',
  color = '#6C63FF',
  className = '',
}: SpinnerProps) {
  return (
    <svg
      className={`animate-spin ${spinnerSizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  SkeletonLoader                                                            */
/* -------------------------------------------------------------------------- */

interface SkeletonLoaderProps {
  /** Number of skeleton rows to render */
  lines?: number;
  /** Whether to show a circle placeholder (e.g. avatar) */
  circle?: boolean;
  className?: string;
}

export function SkeletonLoader({
  lines = 3,
  circle = false,
  className = '',
}: SkeletonLoaderProps) {
  return (
    <div
      className={`animate-pulse space-y-3 ${className}`}
      role="status"
      aria-label="Loading content"
    >
      {circle && (
        <div className="h-12 w-12 rounded-full bg-gray-200" />
      )}

      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg bg-gray-200"
          style={{
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}
