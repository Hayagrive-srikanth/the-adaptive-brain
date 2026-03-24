'use client';

import { motion } from 'framer-motion';
import type { UserProfile } from '@/types';
import {
  Headphones,
  Eye,
  BookOpen,
  Layers,
  Clock,
  Gamepad2,
  BookMarked,
  Zap,
  Globe,
  Sun,
  Moon,
  Sunset,
  Stars,
  CalendarClock,
  BarChart3,
  Flame,
  Users,
  Target,
} from 'lucide-react';

interface ProfileCardProps {
  profile: UserProfile;
  userName: string;
}

const modalityInfo: Record<string, { icon: any; label: string; desc: string }> = {
  audio: { icon: Headphones, label: 'Audio Learner', desc: "You learn best by listening. We'll prioritize audio content for you." },
  visual: { icon: Eye, label: 'Visual Learner', desc: "You learn best through diagrams and visuals. We'll include more visual aids." },
  reading: { icon: BookOpen, label: 'Reading Focused', desc: "You prefer reading text. We'll provide rich written summaries." },
  mixed: { icon: Layers, label: 'Multi-Modal', desc: "You enjoy a mix of formats. We'll vary your content types." },
};

const engagementInfo: Record<string, { icon: any; label: string; desc: string }> = {
  gamified: { icon: Gamepad2, label: 'Gamified', desc: "You love challenges! Expect quizzes, streaks, and rewards." },
  moderate: { icon: BookMarked, label: 'Balanced', desc: "A healthy mix of learning and testing." },
  self_paced: { icon: Zap, label: 'Self-Paced', desc: "You prefer to review at your own speed. Less quizzing, more reading." },
};

const timeInfo: Record<string, { icon: any; label: string }> = {
  morning: { icon: Sun, label: 'Morning Person' },
  afternoon: { icon: Sunset, label: 'Afternoon Studier' },
  evening: { icon: Moon, label: 'Evening Learner' },
  night: { icon: Stars, label: 'Night Owl' },
  varies: { icon: CalendarClock, label: 'Flexible Schedule' },
};

const motivationInfo: Record<string, { icon: any; label: string }> = {
  progress_stats: { icon: BarChart3, label: 'Stats Driven' },
  streaks: { icon: Flame, label: 'Streak Chaser' },
  social: { icon: Users, label: 'Social Competitor' },
  outcome_focused: { icon: Target, label: 'Goal Oriented' },
};

export function ProfileCard({ profile, userName }: ProfileCardProps) {
  const modality = modalityInfo[profile.learning_modality] || modalityInfo.mixed;
  const engagement = engagementInfo[profile.engagement_style] || engagementInfo.moderate;
  const studyTime = timeInfo[profile.study_time_preference] || timeInfo.varies;
  const motivation = motivationInfo[profile.motivation_type] || motivationInfo.progress_stats;

  const ModalityIcon = modality.icon;
  const EngagementIcon = engagement.icon;
  const StudyTimeIcon = studyTime.icon;
  const MotivationIcon = motivation.icon;

  const traits = [
    {
      icon: ModalityIcon,
      label: 'Learning Style',
      value: modality.label,
      description: modality.desc,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: Clock,
      label: 'Focus Duration',
      value: `~${profile.attention_span_minutes} minutes`,
      description: `Your sessions are sized for ${profile.attention_span_minutes}-minute blocks.`,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: EngagementIcon,
      label: 'Engagement Style',
      value: engagement.label,
      description: engagement.desc,
      color: 'bg-green-50 text-green-600',
    },
    {
      icon: Globe,
      label: 'Language',
      value: profile.language.english_comfort === 'native'
        ? 'Native English'
        : profile.language.english_comfort === 'comfortable'
        ? 'Comfortable with English'
        : 'Simplified vocabulary',
      description:
        profile.language.english_comfort === 'struggling'
          ? "We'll use simpler vocabulary and define complex terms."
          : "Standard academic vocabulary.",
      color: 'bg-teal-50 text-teal-600',
    },
    {
      icon: StudyTimeIcon,
      label: 'Study Time',
      value: studyTime.label,
      description: `Reminders optimized for your ${profile.study_time_preference} schedule.`,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: MotivationIcon,
      label: 'Motivation',
      value: motivation.label,
      description: `We'll keep you motivated with ${profile.motivation_type === 'progress_stats' ? 'detailed progress stats' : profile.motivation_type === 'streaks' ? 'streak tracking and daily goals' : profile.motivation_type === 'social' ? 'competitive features' : 'clear outcome tracking'}.`,
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] px-6 py-5">
        <h2 className="text-white text-xl font-bold">{userName}&apos;s Learning Profile</h2>
        <p className="text-white/80 text-sm mt-1">Your personalized learning identity</p>
      </div>

      <div className="p-6 space-y-4">
        {traits.map((trait, index) => {
          const Icon = trait.icon;
          return (
            <motion.div
              key={trait.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${trait.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {trait.label}
                  </span>
                </div>
                <p className="font-semibold text-gray-900">{trait.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{trait.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
