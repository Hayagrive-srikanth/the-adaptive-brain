'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Moon,
  Clock,
  BookOpen,
  CheckCircle2,
  Heart,
  Wind,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectStats {
  totalHoursStudied: number;
  topicsMastered: number;
  readinessScore: number;
}

interface WeakTopic {
  id: string;
  name: string;
  mastery: number;
}

interface ExamEveProps {
  project: {
    id: string;
    name: string;
    stats: ProjectStats;
  };
  weakTopics: WeakTopic[];
}

/* ------------------------------------------------------------------ */
/*  Encouragement messages                                             */
/* ------------------------------------------------------------------ */

const encouragements = [
  "You've been putting in the work, and it shows. Trust what you know.",
  "Take a deep breath. You're more prepared than you think.",
  "Remember: you don't need to be perfect. You just need to be you.",
  "Tonight is for rest, not cramming. Your brain needs sleep to consolidate everything you've learned.",
  "You've studied hard. Tomorrow, let your preparation do the talking.",
  "The fact that you're here shows dedication. Be proud of how far you've come.",
  "Confidence isn't knowing everything — it's trusting your preparation.",
  "You've done the hard part already. Tomorrow is just the finish line.",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ExamEve({ project, weakTopics }: ExamEveProps) {
  const message = useMemo(
    () => encouragements[Math.floor(Math.random() * encouragements.length)],
    [],
  );

  const topFive = weakTopics.slice(0, 5);

  return (
    <motion.div
      className="rounded-2xl overflow-hidden shadow-lg shadow-[#6C63FF]/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Header gradient */}
      <div className="bg-gradient-to-br from-[#6C63FF] via-[#7B73FF] to-[#8F88FF] px-6 py-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Moon className="w-5 h-5 opacity-90" />
          <span className="text-sm font-medium opacity-90">Exam Eve</span>
        </div>
        <h2 className="text-xl font-bold">
          Tomorrow is the day, you&apos;re ready.
        </h2>
      </div>

      <div className="bg-white px-6 py-5 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<Clock className="w-4 h-4 text-[#6C63FF]" />}
            label="Hours Studied"
            value={`${project.stats.totalHoursStudied}h`}
          />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4 text-[#22C55E]" />}
            label="Topics Mastered"
            value={String(project.stats.topicsMastered)}
          />
          <StatCard
            icon={<Sparkles className="w-4 h-4 text-[#FF6B35]" />}
            label="Readiness"
            value={`${project.stats.readinessScore}%`}
          />
        </div>

        {/* Encouragement */}
        <motion.div
          className="bg-[#6C63FF]/[0.04] border border-[#6C63FF]/10 rounded-xl px-5 py-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-[#6C63FF] shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 leading-relaxed italic">
              &ldquo;{message}&rdquo;
            </p>
          </div>
        </motion.div>

        {/* Quick reference: weakest topics */}
        {topFive.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#6C63FF]" />
              Quick Review — Your Top 5
            </h3>
            <div className="space-y-2">
              {topFive.map((topic, i) => (
                <motion.div
                  key={topic.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i }}
                >
                  <span className="text-sm text-gray-700 font-medium">
                    {topic.name}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {topic.mastery}% mastery
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Breathing exercise link */}
        <Link
          href={`/session/${project.id}/focus`}
          className="flex items-center gap-3 bg-gradient-to-r from-[#6C63FF]/5 to-transparent
                     rounded-xl px-5 py-4 group hover:from-[#6C63FF]/10 transition-colors"
        >
          <Wind className="w-5 h-5 text-[#6C63FF] group-hover:scale-110 transition-transform" />
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Try a breathing exercise
            </p>
            <p className="text-xs text-gray-400">
              Calm your mind before the big day
            </p>
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
    </div>
  );
}
