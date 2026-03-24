'use client';

import { motion } from 'framer-motion';
import { Clock, Play, CheckCircle2, CalendarOff } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { StudyPlanDay, Topic } from '@/types';

interface TodaySessionProps {
  planDay: StudyPlanDay | null;
  topics: Topic[];
  projectId: string;
  onStartSession: () => void;
}

export default function TodaySession({
  planDay,
  topics,
  projectId,
  onStartSession,
}: TodaySessionProps) {
  // No plan day
  if (!planDay) {
    return (
      <Card className="text-center py-8">
        <CalendarOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">
          No study planned for today
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Check back tomorrow or update your study plan.
        </p>
      </Card>
    );
  }

  // Already completed
  if (planDay.completed) {
    return (
      <Card variant="highlighted" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#22C55E]/5 rounded-full -translate-y-1/2 translate-x-1/2" />

        <div className="flex items-center gap-3 mb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          >
            <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
          </motion.div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">
              Today&apos;s Session Complete
            </h3>
            {planDay.actual_minutes && (
              <p className="text-sm text-gray-500">
                Studied for {planDay.actual_minutes} minutes
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {planDay.topic_ids.map((tid) => {
            const topic = topics.find((t) => t.id === tid);
            return topic ? (
              <span
                key={tid}
                className="px-3 py-1 bg-[#22C55E]/10 text-[#22C55E] text-sm font-medium rounded-full"
              >
                {topic.name}
              </span>
            ) : null;
          })}
        </div>
      </Card>
    );
  }

  // Ready to start
  const scheduledTopics = planDay.topic_ids
    .map((tid) => topics.find((t) => t.id === tid))
    .filter(Boolean) as Topic[];

  const sessionTypeLabels: Record<string, string> = {
    new_material: 'New Material',
    review: 'Review',
    mixed: 'Mixed Session',
    mock_exam: 'Mock Exam',
  };

  return (
    <Card variant="highlighted" className="relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#6C63FF]/10 to-[#FF6B35]/5 rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-lg">
            Today&apos;s Session
          </h3>
          <span className="px-3 py-1 bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-semibold rounded-full">
            {sessionTypeLabels[planDay.session_type] ?? planDay.session_type}
          </span>
        </div>

        {/* Scheduled topics */}
        <div className="flex flex-wrap gap-2 mb-4">
          {scheduledTopics.map((topic) => (
            <span
              key={topic.id}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full"
            >
              {topic.name}
            </span>
          ))}
        </div>

        {/* Estimated time */}
        <div className="flex items-center gap-2 text-gray-500 mb-5">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            ~{planDay.estimated_minutes} minutes
          </span>
        </div>

        {/* Start button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onStartSession}
        >
          <Play className="w-5 h-5" />
          Start Studying
        </Button>
      </div>
    </Card>
  );
}
