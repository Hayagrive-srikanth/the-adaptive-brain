'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';

interface BreathingExerciseProps {
  duration: 1 | 2; // minutes
  onComplete: () => void;
}

type BreathPhase = 'inhale' | 'hold' | 'exhale';

const PHASE_DURATION = 4; // seconds per phase

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Breathe In',
  hold: 'Hold',
  exhale: 'Breathe Out',
};

const PHASE_COLORS: Record<BreathPhase, string> = {
  inhale: '#A7C7E7',
  hold: '#9B8FD4',
  exhale: '#6C63FF',
};

export default function BreathingExercise({ duration, onComplete }: BreathingExerciseProps) {
  const [isRunning, setIsRunning] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [phaseTimer, setPhaseTimer] = useState(PHASE_DURATION);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });

      setPhaseTimer((prev) => {
        if (prev <= 1) {
          // Cycle to next phase
          setPhase((currentPhase) => {
            if (currentPhase === 'inhale') return 'hold';
            if (currentPhase === 'hold') return 'exhale';
            return 'inhale';
          });
          return PHASE_DURATION;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  useEffect(() => {
    if (secondsLeft === 0 && !isRunning) {
      // Auto-complete after a brief pause
      const timeout = setTimeout(onComplete, 1500);
      return () => clearTimeout(timeout);
    }
  }, [secondsLeft, isRunning, onComplete]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    onComplete();
  }, [onComplete]);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const circleScale = phase === 'inhale' ? 1.5 : phase === 'hold' ? 1.5 : 1;
  const color = PHASE_COLORS[phase];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Timer */}
      <p className="text-sm text-gray-400 font-medium mb-8">
        {formatTime(secondsLeft)} remaining
      </p>

      {/* Breathing circle */}
      <div className="relative mb-8">
        <motion.div
          animate={{
            scale: circleScale,
            backgroundColor: color,
          }}
          transition={{
            scale: { duration: PHASE_DURATION, ease: 'easeInOut' },
            backgroundColor: { duration: 1.5, ease: 'easeInOut' },
          }}
          className="w-40 h-40 rounded-full flex items-center justify-center shadow-xl"
          style={{ backgroundColor: color }}
        >
          <motion.div
            animate={{ scale: circleScale }}
            transition={{ duration: PHASE_DURATION, ease: 'easeInOut' }}
            className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-white font-bold text-lg">
                {PHASE_LABELS[phase]}
              </p>
              <p className="text-white/70 text-2xl font-bold mt-1">
                {phaseTimer}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Outer glow ring */}
        <motion.div
          animate={{
            scale: circleScale,
            opacity: phase === 'inhale' ? 0.3 : 0.1,
          }}
          transition={{ duration: PHASE_DURATION, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            transform: 'scale(1.6)',
          }}
        />
      </div>

      {/* Phase indicator dots */}
      <div className="flex items-center gap-3 mb-8">
        {(['inhale', 'hold', 'exhale'] as BreathPhase[]).map((p) => (
          <div
            key={p}
            className={`flex items-center gap-1.5 text-xs font-medium ${
              phase === p ? 'text-gray-700' : 'text-gray-300'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                phase === p ? 'bg-[#6C63FF]' : 'bg-gray-200'
              }`}
            />
            {PHASE_LABELS[p]}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <button
          onClick={handleSkip}
          className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition-colors"
        >
          Skip
        </button>
        {secondsLeft === 0 && (
          <Button
            onClick={onComplete}
            className="bg-[#6C63FF] hover:bg-[#5B54E6] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
