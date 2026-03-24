'use client';

import { motion } from 'framer-motion';

interface ReadinessScoreProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score < 30) return '#EF4444';
  if (score < 60) return '#F97316';
  if (score < 80) return '#EAB308';
  return '#22C55E';
}

export default function ReadinessScore({ score }: ReadinessScoreProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = getScoreColor(clamped);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg
          width="144"
          height="144"
          viewBox="0 0 144 144"
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress circle */}
          <motion.circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {clamped}%
          </motion.span>
        </div>
      </div>
      <span className="text-sm font-medium text-gray-500">Readiness</span>
    </div>
  );
}
