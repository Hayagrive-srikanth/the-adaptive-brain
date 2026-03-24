'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface XPBarProps {
  currentXP: number;
  goalXP: number;
  level: number;
  className?: string;
}

export default function XPBar({ currentXP, goalXP, level, className = '' }: XPBarProps) {
  const percentage = Math.min((currentXP / goalXP) * 100, 100);

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#6C63FF]/10">
            <Zap className="w-4 h-4 text-[#6C63FF]" />
          </div>
          <span className="text-sm font-medium text-gray-600">Daily XP</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            {currentXP} / {goalXP} XP
          </span>
          <div className="flex items-center gap-1 bg-[#6C63FF] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <span>Lv.{level}</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #6C63FF 0%, #8B83FF 50%, #A89FFF 100%)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Shimmer effect on the fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full opacity-30"
          style={{
            width: `${percentage}%`,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {percentage >= 100 && (
        <motion.p
          className="text-xs text-[#22C55E] font-medium mt-2 text-center"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Daily goal reached!
        </motion.p>
      )}
    </div>
  );
}
