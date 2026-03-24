'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Award, Clock, Target, ArrowRight } from 'lucide-react';
import { SessionWrapUp as SessionWrapUpType } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface SessionWrapUpProps {
  wrapUp: SessionWrapUpType;
  onClose: () => void;
}

function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const steps = 30;
    const increment = target / steps;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.round(current));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);

  return value;
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return 'text-[#22C55E]';
  if (accuracy >= 60) return 'text-[#FF6B35]';
  return 'text-[#EF4444]';
}

function getReadinessColor(score: number): string {
  if (score >= 80) return 'text-[#22C55E]';
  if (score >= 50) return 'text-[#6C63FF]';
  return 'text-[#FF6B35]';
}

const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function SessionWrapUpComponent({
  wrapUp,
  onClose,
}: SessionWrapUpProps) {
  const accuracy = wrapUp.accuracy ?? 0;
  const isCelebratory = accuracy >= 80;

  const animatedXp = useCountUp(wrapUp.xp_earned ?? 0);
  const animatedAccuracy = useCountUp(Math.round(accuracy));

  const getMessage = useCallback((): string => {
    if (wrapUp.message) return wrapUp.message;
    if (accuracy >= 90) return 'Outstanding work! You crushed it today.';
    if (accuracy >= 80) return 'Great session! Keep up the momentum.';
    if (accuracy >= 60) return 'Solid effort. A little review will go a long way.';
    return 'Every session makes you stronger. See you next time!';
  }, [accuracy, wrapUp.message]);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
          className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isCelebratory ? 'bg-[#FF6B35]/10' : 'bg-[#6C63FF]/10'
          }`}
        >
          <Award
            className={`w-10 h-10 ${
              isCelebratory ? 'text-[#FF6B35]' : 'text-[#6C63FF]'
            }`}
          />
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
          Session Complete!
        </h2>
        <p className="text-gray-500">{getMessage()}</p>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={fadeUp}>
        <Card className="p-6 md:p-8">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            {/* Topics covered */}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Target className="w-5 h-5 text-[#6C63FF] mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {wrapUp.topics_covered ?? 0}
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Topics Covered
              </p>
            </div>

            {/* Questions answered */}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <svg
                className="w-5 h-5 text-[#6C63FF] mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-2xl font-bold text-gray-900">
                {wrapUp.questions_answered ?? 0}
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Questions Answered
              </p>
            </div>

            {/* Accuracy */}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <svg
                className="w-5 h-5 text-[#6C63FF] mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className={`text-2xl font-bold ${getAccuracyColor(accuracy)}`}>
                {animatedAccuracy}%
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Accuracy
              </p>
            </div>

            {/* Time spent */}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <Clock className="w-5 h-5 text-[#6C63FF] mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {formatTimeSpent(wrapUp.time_spent_seconds ?? 0)}
              </p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Time Spent
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* XP earned */}
      <motion.div variants={fadeUp}>
        <Card className="p-6 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.6 }}
          >
            <p className="text-sm text-gray-500 font-medium mb-1">XP Earned</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-extrabold text-[#FF6B35]">
                +{animatedXp}
              </span>
              <span className="text-2xl">&#11088;</span>
              <span className="text-lg font-bold text-[#FF6B35]">XP</span>
            </div>
          </motion.div>
        </Card>
      </motion.div>

      {/* Readiness score */}
      {wrapUp.readiness_before != null && wrapUp.readiness_after != null && (
        <motion.div variants={fadeUp}>
          <Card className="p-6">
            <p className="text-sm text-gray-500 font-medium text-center mb-4">
              Readiness Score
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Before</p>
                <p
                  className={`text-3xl font-bold ${getReadinessColor(
                    wrapUp.readiness_before
                  )}`}
                >
                  {wrapUp.readiness_before}%
                </p>
              </div>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="flex items-center"
              >
                <ArrowRight
                  className={`w-8 h-8 ${
                    wrapUp.readiness_after > wrapUp.readiness_before
                      ? 'text-[#22C55E]'
                      : 'text-gray-400'
                  }`}
                />
              </motion.div>

              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">After</p>
                <p
                  className={`text-3xl font-bold ${getReadinessColor(
                    wrapUp.readiness_after
                  )}`}
                >
                  {wrapUp.readiness_after}%
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div variants={fadeUp} className="pt-2">
        <Button
          onClick={onClose}
          className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
        >
          Back to Project
        </Button>
      </motion.div>
    </motion.div>
  );
}
