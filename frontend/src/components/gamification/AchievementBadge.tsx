'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Flame,
  BookOpen,
  Brain,
  Target,
  Zap,
  Star,
  Clock,
  Users,
  GraduationCap,
  Rocket,
  Heart,
  type LucideIcon,
} from 'lucide-react';

export interface Achievement {
  id: string;
  type: string;
  name: string;
  description: string;
  locked: boolean;
  earned_at?: string;
  xp_awarded: number;
  hint?: string;
}

const achievementIcons: Record<string, LucideIcon> = {
  first_session: BookOpen,
  streak_3: Flame,
  streak_7: Flame,
  streak_30: Flame,
  perfect_quiz: Target,
  speed_learner: Zap,
  topic_master: Brain,
  night_owl: Clock,
  early_bird: Clock,
  social_learner: Users,
  course_complete: GraduationCap,
  xp_milestone: Trophy,
  quick_start: Rocket,
  consistency: Star,
  wellbeing: Heart,
};

interface AchievementBadgeProps {
  achievement: Achievement;
  className?: string;
}

export default function AchievementBadge({ achievement, className = '' }: AchievementBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const Icon = achievementIcons[achievement.type] || Trophy;
  const isEarned = !achievement.locked;

  return (
    <>
      <motion.button
        onClick={() => setShowDetails(true)}
        className={`
          relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors
          ${
            isEarned
              ? 'bg-white border border-[#6C63FF]/20 shadow-sm hover:shadow-md'
              : 'bg-gray-50 border border-gray-100 opacity-60 hover:opacity-80'
          }
          ${className}
        `}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Badge icon */}
        <div
          className={`
            relative flex items-center justify-center w-14 h-14 rounded-full
            ${isEarned ? 'bg-[#6C63FF]/10' : 'bg-gray-200'}
          `}
        >
          <Icon
            className={`w-7 h-7 ${isEarned ? 'text-[#6C63FF]' : 'text-gray-400'}`}
          />

          {/* Glow ring for earned badges */}
          {isEarned && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#6C63FF]/30"
              animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Name */}
        <span
          className={`text-xs font-medium text-center leading-tight ${
            isEarned ? 'text-gray-800' : 'text-gray-400'
          }`}
        >
          {achievement.name}
        </span>

        {/* XP indicator */}
        {isEarned && (
          <span className="text-[10px] font-bold text-[#6C63FF] bg-[#6C63FF]/10 px-2 py-0.5 rounded-full">
            +{achievement.xp_awarded} XP
          </span>
        )}
      </motion.button>

      {/* Details modal */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowDetails(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Card */}
            <motion.div
              className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div
                  className={`
                    flex items-center justify-center w-16 h-16 rounded-full
                    ${isEarned ? 'bg-[#6C63FF]/10' : 'bg-gray-100'}
                  `}
                >
                  <Icon
                    className={`w-8 h-8 ${isEarned ? 'text-[#6C63FF]' : 'text-gray-400'}`}
                  />
                </div>

                <h3 className="text-lg font-bold text-gray-900">{achievement.name}</h3>
                <p className="text-sm text-gray-500">{achievement.description}</p>

                {isEarned && achievement.earned_at && (
                  <p className="text-xs text-gray-400">
                    Earned {new Date(achievement.earned_at).toLocaleDateString()}
                  </p>
                )}

                {isEarned && (
                  <div className="flex items-center gap-1 text-[#6C63FF] font-bold text-sm">
                    <Zap className="w-4 h-4" />
                    <span>+{achievement.xp_awarded} XP awarded</span>
                  </div>
                )}

                {!isEarned && achievement.hint && (
                  <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-4 py-2">
                    Hint: {achievement.hint}
                  </p>
                )}

                <button
                  onClick={() => setShowDetails(false)}
                  className="mt-2 w-full py-2.5 rounded-xl bg-[#6C63FF] text-white text-sm font-semibold hover:bg-[#5B54E6] transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
