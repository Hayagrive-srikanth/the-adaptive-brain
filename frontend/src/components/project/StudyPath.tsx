'use client';

import { motion } from 'framer-motion';
import { Lock, Check, BookOpen } from 'lucide-react';
import type { Topic } from '@/types';

interface StudyPathProps {
  topics: Topic[];
  onSelectTopic: (topicId: string) => void;
}

type NodeState = 'locked' | 'available' | 'in_progress' | 'mastered';

function getNodeState(topic: Topic, allTopics: Topic[]): NodeState {
  if (topic.status === 'mastered') return 'mastered';
  if (topic.status === 'in_progress') return 'in_progress';

  // Check if prerequisites are met
  const prerequisitesMet = topic.prerequisite_ids.every((preId) => {
    const preTopic = allTopics.find((t) => t.id === preId);
    return preTopic?.status === 'mastered';
  });

  if (!prerequisitesMet) return 'locked';
  return 'available';
}

function NodeIcon({ state }: { state: NodeState }) {
  switch (state) {
    case 'locked':
      return <Lock className="w-6 h-6 text-gray-400" />;
    case 'mastered':
      return <Check className="w-7 h-7 text-white" strokeWidth={3} />;
    case 'available':
    case 'in_progress':
      return <BookOpen className="w-6 h-6 text-white" />;
  }
}

function nodeStyles(state: NodeState): string {
  switch (state) {
    case 'locked':
      return 'bg-gray-200 opacity-50 cursor-not-allowed';
    case 'available':
      return 'bg-[#6C63FF] cursor-pointer hover:shadow-lg hover:shadow-[#6C63FF]/30';
    case 'in_progress':
      return 'bg-[#6C63FF] ring-4 ring-[#6C63FF]/30 cursor-pointer hover:shadow-lg hover:shadow-[#6C63FF]/30';
    case 'mastered':
      return 'bg-[#22C55E] cursor-default';
  }
}

export default function StudyPath({ topics, onSelectTopic }: StudyPathProps) {
  const sortedTopics = [...topics].sort(
    (a, b) => (a.path_order ?? 0) - (b.path_order ?? 0)
  );

  return (
    <div className="w-full py-8">
      <h2 className="text-lg font-bold text-gray-800 mb-6 px-4">Study Path</h2>

      <div className="relative flex flex-col items-center gap-2">
        {sortedTopics.map((topic, index) => {
          const state = getNodeState(topic, topics);
          const isClickable = state === 'available' || state === 'in_progress';
          // Alternate left/right offset for visual interest
          const offsetX = index % 2 === 0 ? -40 : 40;

          return (
            <div key={topic.id} className="relative flex flex-col items-center">
              {/* Connecting line from previous node */}
              {index > 0 && (
                <svg
                  className="w-24 h-10 -mb-1"
                  viewBox="0 0 96 40"
                  fill="none"
                >
                  <path
                    d={`M ${48 + (index % 2 === 0 ? 40 : -40)} 0 Q 48 20 ${48 + offsetX} 40`}
                    stroke="#D1D5DB"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Node + label row */}
              <div
                className="flex items-center gap-4"
                style={{ transform: `translateX(${offsetX}px)` }}
              >
                {/* Topic label (left side on even, right side on odd) */}
                {index % 2 === 0 && (
                  <span className="w-28 text-right text-sm font-medium text-gray-600 truncate">
                    {topic.name}
                  </span>
                )}

                {/* Node circle */}
                <motion.button
                  onClick={() => isClickable && onSelectTopic(topic.id)}
                  disabled={!isClickable}
                  className={`
                    relative flex items-center justify-center rounded-full
                    transition-all duration-200
                    ${state === 'in_progress' ? 'w-20 h-20' : 'w-16 h-16'}
                    ${nodeStyles(state)}
                  `}
                  whileHover={isClickable ? { scale: 1.1 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                  aria-label={`${topic.name} - ${state}`}
                >
                  <NodeIcon state={state} />

                  {/* Pulse animation for available nodes */}
                  {state === 'available' && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-[#6C63FF]"
                      initial={{ opacity: 0.4, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.5 }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                    />
                  )}
                </motion.button>

                {/* Topic label (right side on odd) */}
                {index % 2 !== 0 && (
                  <span className="w-28 text-left text-sm font-medium text-gray-600 truncate">
                    {topic.name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
