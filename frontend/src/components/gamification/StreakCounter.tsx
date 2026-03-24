'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Shield } from 'lucide-react';

interface StreakCounterProps {
  streakCount: number;
  streakFreezeAvailable: boolean;
  atRisk: boolean;
  className?: string;
}

export default function StreakCounter({
  streakCount,
  streakFreezeAvailable,
  atRisk,
  className = '',
}: StreakCounterProps) {
  // Scale the flame based on streak length (1.0 to 1.6)
  const flameScale = Math.min(1 + streakCount * 0.05, 1.6);

  return (
    <div
      className={`
        bg-white rounded-2xl p-5 shadow-sm border
        ${atRisk ? 'border-[#FF6B35]' : 'border-gray-100'}
        ${className}
      `}
    >
      <div className="flex items-center gap-4">
        {/* Animated flame */}
        <motion.div
          className="relative flex items-center justify-center"
          animate={
            atRisk
              ? {
                  scale: [flameScale, flameScale * 1.15, flameScale],
                }
              : { scale: flameScale }
          }
          transition={
            atRisk
              ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
              : { type: 'spring', stiffness: 200, damping: 15 }
          }
        >
          <div
            className={`
              flex items-center justify-center w-12 h-12 rounded-full
              ${atRisk ? 'bg-[#FF6B35]/15' : 'bg-orange-50'}
            `}
          >
            <Flame
              className={`w-6 h-6 ${atRisk ? 'text-[#FF6B35]' : 'text-orange-500'}`}
              fill={streakCount > 0 ? 'currentColor' : 'none'}
            />
          </div>

          {/* Glow effect for high streaks */}
          {streakCount >= 7 && (
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-400/20 blur-md"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.div>

        {/* Streak info */}
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900">{streakCount}</span>
            <span className="text-sm text-gray-500">day streak</span>
          </div>

          {atRisk && (
            <motion.p
              className="text-xs font-medium text-[#FF6B35] mt-0.5"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Study today to keep your streak!
            </motion.p>
          )}

          {!atRisk && streakCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">Keep it going!</p>
          )}
        </div>

        {/* Streak freeze indicator */}
        {streakFreezeAvailable && (
          <div className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-medium px-2.5 py-1.5 rounded-full">
            <Shield className="w-3.5 h-3.5" />
            <span>Freeze</span>
          </div>
        )}
      </div>
    </div>
  );
}
