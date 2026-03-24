'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ArrowUpDown,
  BarChart3,
  ListOrdered,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import type { Topic } from '@/types';

interface TopicMapProps {
  topics: Topic[];
}

type SortMode = 'path' | 'mastery';

const difficultyConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  foundational: { label: 'Foundational', color: '#22C55E', bg: 'bg-green-50 text-green-700' },
  intermediate: { label: 'Intermediate', color: '#EAB308', bg: 'bg-yellow-50 text-yellow-700' },
  advanced: { label: 'Advanced', color: '#EF4444', bg: 'bg-red-50 text-red-700' },
};

function StatusIcon({ status }: { status: Topic['status'] }) {
  switch (status) {
    case 'mastered':
      return <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />;
    case 'in_progress':
      return <BookOpen className="w-5 h-5 text-[#6C63FF]" />;
    default:
      return <Circle className="w-5 h-5 text-gray-300" />;
  }
}

export default function TopicMap({ topics }: TopicMapProps) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>('path');

  const sortedTopics = [...topics].sort((a, b) => {
    if (sortMode === 'mastery') {
      return b.mastery_percentage - a.mastery_percentage;
    }
    return (a.path_order ?? 0) - (b.path_order ?? 0);
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-bold text-gray-800">All Topics</h2>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setSortMode('path')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              sortMode === 'path'
                ? 'bg-white text-[#6C63FF] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Order
          </button>
          <button
            onClick={() => setSortMode('mastery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              sortMode === 'mastery'
                ? 'bg-white text-[#6C63FF] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Mastery
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {sortedTopics.map((topic) => {
            const difficulty = difficultyConfig[topic.difficulty] ?? difficultyConfig.foundational;

            return (
              <motion.div
                key={topic.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Card
                  variant="interactive"
                  className="!p-4"
                  onClick={() =>
                    router.push(
                      `/project/${topic.project_id}/topic/${topic.id}`
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5">
                      <StatusIcon status={topic.status} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 truncate">
                          {topic.name}
                        </span>
                        <span
                          className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${difficulty.bg}`}
                        >
                          {difficulty.label}
                        </span>
                      </div>

                      <ProgressBar
                        value={topic.mastery_percentage}
                        color={difficulty.color}
                        height={8}
                        className="mt-2"
                      />

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-400">
                          {Math.round(topic.mastery_percentage)}% mastered
                        </span>
                        {topic.estimated_minutes && (
                          <span className="text-xs text-gray-400">
                            ~{topic.estimated_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
