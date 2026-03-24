'use client';

import React, { useEffect, useCallback, useMemo } from 'react';
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

interface AchievementUnlockProps {
  show: boolean;
  name: string;
  description: string;
  type: string;
  xpAwarded: number;
  onDismiss: () => void;
}

// Sparkle particle component
function Sparkle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full bg-[#6C63FF]"
      style={{ left: '50%', top: '50%' }}
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.5, 1, 0],
        x: x,
        y: y,
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export default function AchievementUnlock({
  show,
  name,
  description,
  type,
  xpAwarded,
  onDismiss,
}: AchievementUnlockProps) {
  const Icon = achievementIcons[type] || Trophy;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  // Memoize sparkle data so positions are stable across renders
  const sparkles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 80 + (i % 3) * 30;
        return {
          key: i,
          delay: i * 0.05,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        };
      }),
    []
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className="relative flex flex-col items-center text-center z-10"
            initial={{ scale: 0, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200, duration: 0.6 }}
          >
            {/* Sparkle particles */}
            <div className="absolute inset-0 pointer-events-none">
              {sparkles.map((s) => (
                <Sparkle key={s.key} delay={s.delay} x={s.x} y={s.y} />
              ))}
            </div>

            {/* Glowing ring */}
            <motion.div
              className="relative mb-6"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <div className="w-28 h-28 rounded-full border-4 border-dashed border-[#6C63FF]/40" />
            </motion.div>

            {/* Badge icon (overlaid on ring) */}
            <motion.div
              className="absolute top-0 mt-0 flex items-center justify-center w-28 h-28 rounded-full bg-[#6C63FF] shadow-lg shadow-[#6C63FF]/40"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5, times: [0, 0.6, 1] }}
            >
              <Icon className="w-12 h-12 text-white" />
            </motion.div>

            {/* Text content */}
            <motion.div
              className="bg-white rounded-2xl p-6 pt-8 max-w-xs w-full shadow-2xl -mt-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.p
                className="text-xs font-bold uppercase tracking-wider text-[#6C63FF] mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Achievement Unlocked!
              </motion.p>

              <motion.h2
                className="text-xl font-bold text-gray-900 mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                {name}
              </motion.h2>

              <motion.p
                className="text-sm text-gray-500 mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {description}
              </motion.p>

              <motion.div
                className="flex items-center justify-center gap-1 text-[#FF6B35] font-bold text-lg mb-5"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, type: 'spring' }}
              >
                <Zap className="w-5 h-5" />
                <span>+{xpAwarded} XP</span>
              </motion.div>

              <motion.button
                onClick={onDismiss}
                className="w-full py-3 rounded-xl bg-[#6C63FF] text-white font-semibold text-sm hover:bg-[#5B54E6] transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Awesome!
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
