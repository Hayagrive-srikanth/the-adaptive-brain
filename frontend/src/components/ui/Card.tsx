'use client';

import React from 'react';

type CardVariant = 'default' | 'highlighted' | 'interactive';

interface CardProps {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white shadow-sm border border-gray-100',
  highlighted: 'bg-white shadow-sm border-2 border-[#6C63FF]',
  interactive:
    'bg-white shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99]',
};

export default function Card({
  variant = 'default',
  children,
  className = '',
  onClick,
}: CardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`
        rounded-2xl p-6 transition-all duration-200 ease-in-out
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
