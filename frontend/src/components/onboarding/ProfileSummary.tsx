'use client';

import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  Gamepad2,
  Languages,
  Sun,
  Target,
} from 'lucide-react';
import type { UserProfile } from '@/types';

interface ProfileSummaryProps {
  profile: UserProfile;
  onConfirm: () => void;
}

const modalityLabels: Record<UserProfile['learning_modality'], string> = {
  reading: 'Text-based learner',
  audio: 'Audio learner',
  visual: 'Visual learner',
  mixed: 'Multimodal learner',
};

const engagementLabels: Record<UserProfile['engagement_style'], string> = {
  gamified: 'Loves quizzes & challenges',
  moderate: 'Enjoys challenges in moderation',
  self_paced: 'Prefers self-paced review',
};

const languageLabels: Record<UserProfile['language']['english_comfort'], string> = {
  native: 'Native English speaker',
  comfortable: 'Comfortable with academic English',
  struggling: 'May need simplified terminology',
};

const studyTimeLabels: Record<UserProfile['study_time_preference'], string> = {
  morning: 'Morning studier',
  afternoon: 'Afternoon studier',
  evening: 'Evening studier',
  night: 'Night owl',
  varies: 'Flexible schedule',
};

const motivationLabels: Record<UserProfile['motivation_type'], string> = {
  progress_stats: 'Driven by progress stats',
  streaks: 'Motivated by streaks & goals',
  social: 'Energised by friendly competition',
  outcome_focused: 'Focused on the end goal',
};

interface TraitRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  index: number;
}

function TraitRow({ icon, label, value, index }: TraitRowProps) {
  return (
    <motion.div
      className="flex items-start gap-4 py-3"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.08 }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center text-[#6C63FF]">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="text-[15px] font-semibold text-gray-800">{value}</p>
      </div>
    </motion.div>
  );
}

export default function ProfileSummary({ profile, onConfirm }: ProfileSummaryProps) {
  const attentionLabel =
    profile.attention_span_minutes < 10
      ? 'Short bursts (under 10 min)'
      : profile.attention_span_minutes <= 20
        ? 'Moderate focus (10-20 min)'
        : profile.attention_span_minutes <= 40
          ? 'Solid focus (20-40 min)'
          : 'Deep focus (40+ min)';

  const traits: { icon: React.ReactNode; label: string; value: string }[] = [
    {
      icon: <BookOpen size={20} />,
      label: 'Learning Modality',
      value: modalityLabels[profile.learning_modality],
    },
    {
      icon: <Clock size={20} />,
      label: 'Attention Span',
      value: attentionLabel,
    },
    {
      icon: <Gamepad2 size={20} />,
      label: 'Engagement Style',
      value: engagementLabels[profile.engagement_style],
    },
    {
      icon: <Languages size={20} />,
      label: 'Language',
      value: languageLabels[profile.language.english_comfort],
    },
    {
      icon: <Sun size={20} />,
      label: 'Study Time',
      value: studyTimeLabels[profile.study_time_preference],
    },
    {
      icon: <Target size={20} />,
      label: 'Motivation',
      value: motivationLabels[profile.motivation_type],
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        className="rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header band */}
        <div className="bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] px-6 py-5">
          <motion.h2
            className="text-white text-xl font-bold"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Your Learning Identity
          </motion.h2>
          <motion.p
            className="text-white/70 text-sm mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            We&apos;ll tailor everything to fit you
          </motion.p>
        </div>

        {/* Traits */}
        <div className="px-6 py-4 divide-y divide-gray-100">
          {traits.map((trait, i) => (
            <TraitRow
              key={trait.label}
              icon={trait.icon}
              label={trait.label}
              value={trait.value}
              index={i}
            />
          ))}
        </div>
      </motion.div>

      {/* Confirm button */}
      <motion.button
        type="button"
        onClick={onConfirm}
        className="mt-8 w-full py-4 rounded-xl font-semibold text-white text-base
          bg-[#FF6B35] hover:bg-[#e85f2d] active:scale-[0.98]
          shadow-md shadow-[#FF6B35]/25 transition-all duration-200 cursor-pointer"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.35 }}
        whileTap={{ scale: 0.97 }}
      >
        Looks good, let&apos;s go!
      </motion.button>
    </div>
  );
}
