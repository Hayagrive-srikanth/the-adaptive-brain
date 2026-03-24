import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  /** Icon element rendered above the title */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Label for the optional action button */
  actionLabel?: string;
  /** Callback when the action button is clicked */
  onAction?: () => void;
  className?: string;
}

function DefaultIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-16 w-16 text-[#6C63FF]/30"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      <div className="mb-4">{icon ?? <DefaultIcon />}</div>

      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-gray-500">{description}</p>
      )}

      {actionLabel && onAction && (
        <div className="mt-6">
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
