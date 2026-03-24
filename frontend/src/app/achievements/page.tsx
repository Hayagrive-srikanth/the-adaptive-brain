'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import AuthGuard from '@/components/auth/AuthGuard';
import AchievementBadge, { type Achievement } from '@/components/gamification/AchievementBadge';

// ── All 12 achievement type definitions ──────────────────────────

interface AchievementDef {
  type: string;
  name: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  defaultXP: number;
}

const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  {
    type: 'first_session',
    name: 'First Steps',
    description: 'Complete your very first study session.',
    hint: 'Start a study session to unlock this.',
    icon: BookOpen,
    defaultXP: 50,
  },
  {
    type: 'streak_3',
    name: 'On Fire',
    description: 'Maintain a 3-day study streak.',
    hint: 'Study for 3 days in a row.',
    icon: Flame,
    defaultXP: 100,
  },
  {
    type: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day study streak.',
    hint: 'Study every day for a full week.',
    icon: Flame,
    defaultXP: 250,
  },
  {
    type: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day study streak.',
    hint: 'Keep your streak alive for an entire month.',
    icon: Flame,
    defaultXP: 1000,
  },
  {
    type: 'perfect_quiz',
    name: 'Perfect Score',
    description: 'Get 100% on a quiz with 5+ questions.',
    hint: 'Ace every question in a quiz.',
    icon: Target,
    defaultXP: 200,
  },
  {
    type: 'speed_learner',
    name: 'Speed Learner',
    description: 'Complete a study session in under 10 minutes.',
    hint: 'Finish a focused session quickly.',
    icon: Zap,
    defaultXP: 75,
  },
  {
    type: 'topic_master',
    name: 'Topic Master',
    description: 'Reach 100% mastery on any topic.',
    hint: 'Fully master a topic through study and quizzes.',
    icon: Brain,
    defaultXP: 300,
  },
  {
    type: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a study session after 10 PM.',
    hint: 'Study late at night.',
    icon: Clock,
    defaultXP: 50,
  },
  {
    type: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a study session before 7 AM.',
    hint: 'Start studying before sunrise.',
    icon: Clock,
    defaultXP: 50,
  },
  {
    type: 'social_learner',
    name: 'Social Learner',
    description: 'Share your progress with a friend.',
    hint: 'Use the share feature to show your progress.',
    icon: Users,
    defaultXP: 75,
  },
  {
    type: 'course_complete',
    name: 'Graduate',
    description: 'Complete all topics in a project.',
    hint: 'Finish every topic in one of your study projects.',
    icon: GraduationCap,
    defaultXP: 500,
  },
  {
    type: 'quick_start',
    name: 'Quick Start',
    description: 'Start studying within 5 minutes of creating a project.',
    hint: 'Jump right into learning after creating a project.',
    icon: Rocket,
    defaultXP: 50,
  },
];

type FilterTab = 'all' | 'earned' | 'locked';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => {
    fetchAchievements();
  }, []);

  async function fetchAchievements() {
    try {
      setLoading(true);
      // Dynamic import to avoid SSR issues with the api client
      const { default: apiModule } = await import('@/lib/api').catch(() => ({ default: null }));

      let earnedMap: Record<string, any> = {};

      try {
        const res = await fetch('/api/gamification/achievements', {
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null);

        if (res?.ok) {
          const data = await res.json();
          if (Array.isArray(data.achievements)) {
            data.achievements.forEach((a: any) => {
              earnedMap[a.type] = a;
            });
          }
        }
      } catch {
        // API not available, show all as locked
      }

      // Merge definitions with earned data
      const merged: Achievement[] = ACHIEVEMENT_DEFINITIONS.map((def) => {
        const earned = earnedMap[def.type];
        return {
          id: earned?.id || def.type,
          type: def.type,
          name: def.name,
          description: def.description,
          hint: def.hint,
          locked: !earned,
          earned_at: earned?.earned_at,
          xp_awarded: earned?.xp_awarded || def.defaultXP,
        };
      });

      setAchievements(merged);
    } catch (err: any) {
      setError(err.message || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }

  const filtered = achievements.filter((a) => {
    if (filter === 'earned') return !a.locked;
    if (filter === 'locked') return a.locked;
    return true;
  });

  const totalXP = achievements
    .filter((a) => !a.locked)
    .reduce((sum, a) => sum + a.xp_awarded, 0);

  const earnedCount = achievements.filter((a) => !a.locked).length;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'earned', label: 'Earned' },
    { key: 'locked', label: 'Locked' },
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-7 h-7 text-[#6C63FF]" />
              <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
            </div>
            <p className="text-sm text-gray-500">
              Unlock achievements by learning consistently and challenging yourself.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 flex items-center justify-between"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#6C63FF]">{earnedCount}</p>
                <p className="text-xs text-gray-400">Earned</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-300">
                  {achievements.length - earnedCount}
                </p>
                <p className="text-xs text-gray-400">Locked</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#6C63FF]/10 text-[#6C63FF] font-bold text-sm px-4 py-2 rounded-full">
              <Zap className="w-4 h-4" />
              <span>{totalXP} XP</span>
            </div>
          </motion.div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`
                  px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${
                    filter === tab.key
                      ? 'bg-[#6C63FF] text-white shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#6C63FF] border-t-transparent" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 mb-6">
              {error}
            </div>
          )}

          {/* Achievement grid */}
          {!loading && (
            <motion.div
              className="grid grid-cols-3 sm:grid-cols-4 gap-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: { staggerChildren: 0.05 },
                },
              }}
            >
              {filtered.map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                >
                  <AchievementBadge achievement={achievement} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {filter === 'earned'
                  ? 'No achievements earned yet. Keep studying!'
                  : 'All achievements unlocked! Amazing!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
