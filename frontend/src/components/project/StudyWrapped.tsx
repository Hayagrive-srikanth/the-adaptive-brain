'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Trophy,
  Brain,
  Flame,
  Moon,
  Star,
  TrendingUp,
  Target,
  Share2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WrappedData {
  totalHoursStudied: number;
  topicsMastered: number;
  questionsAnswered: number;
  longestStreak: number;
  studyPersonality: string;
  strongestTopic: string;
  mostImprovedTopic: string;
  readinessScore: number;
}

interface StudyWrappedProps {
  wrappedData: WrappedData;
}

/* ------------------------------------------------------------------ */
/*  Screen configurations                                              */
/* ------------------------------------------------------------------ */

interface ScreenConfig {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  getValue: (d: WrappedData) => string | number;
  suffix?: string;
  isCountUp?: boolean;
}

const screens: ScreenConfig[] = [
  {
    gradient: 'from-[#6C63FF] to-[#4F46E5]',
    icon: <Clock className="w-10 h-10" />,
    label: 'Total Hours Studied',
    getValue: (d) => d.totalHoursStudied,
    suffix: 'hours',
    isCountUp: true,
  },
  {
    gradient: 'from-[#7C3AED] to-[#6C63FF]',
    icon: <Trophy className="w-10 h-10" />,
    label: 'Topics Mastered',
    getValue: (d) => d.topicsMastered,
    isCountUp: true,
  },
  {
    gradient: 'from-[#6C63FF] to-[#3B82F6]',
    icon: <Brain className="w-10 h-10" />,
    label: 'Questions Answered',
    getValue: (d) => d.questionsAnswered,
    isCountUp: true,
  },
  {
    gradient: 'from-[#FF6B35] to-[#F59E0B]',
    icon: <Flame className="w-10 h-10" />,
    label: 'Longest Streak',
    getValue: (d) => d.longestStreak,
    suffix: 'days',
    isCountUp: true,
  },
  {
    gradient: 'from-[#4F46E5] to-[#7C3AED]',
    icon: <Moon className="w-10 h-10" />,
    label: 'Study Personality',
    getValue: (d) => d.studyPersonality,
  },
  {
    gradient: 'from-[#6C63FF] to-[#22C55E]',
    icon: <Star className="w-10 h-10" />,
    label: 'Strongest Topic',
    getValue: (d) => d.strongestTopic,
  },
  {
    gradient: 'from-[#3B82F6] to-[#6C63FF]',
    icon: <TrendingUp className="w-10 h-10" />,
    label: 'Most Improved',
    getValue: (d) => d.mostImprovedTopic,
  },
  {
    gradient: 'from-[#6C63FF] to-[#FF6B35]',
    icon: <Target className="w-10 h-10" />,
    label: 'Final Readiness Score',
    getValue: (d) => d.readinessScore,
    suffix: '%',
    isCountUp: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Animated count-up hook                                             */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration = 1500, active = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    let start: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);

  return value;
}

/* ------------------------------------------------------------------ */
/*  Circular progress for final screen                                 */
/* ------------------------------------------------------------------ */

function CircularProgress({
  score,
  active,
}: {
  score: number;
  active: boolean;
}) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const animatedScore = useCountUp(score, 1800, active);
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="relative w-48 h-48">
      <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <motion.circle
          cx="96"
          cy="96"
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: active ? offset : circumference }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-5xl font-bold text-white">{animatedScore}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual wrapped screen                                          */
/* ------------------------------------------------------------------ */

function WrappedScreen({
  config,
  data,
  active,
}: {
  config: ScreenConfig;
  data: WrappedData;
  active: boolean;
}) {
  const rawValue = config.getValue(data);
  const numericValue = typeof rawValue === 'number' ? rawValue : 0;
  const animatedNumber = useCountUp(
    numericValue,
    1500,
    active && config.isCountUp === true,
  );

  const isFinalScreen = config.label === 'Final Readiness Score';

  return (
    <div
      className={`flex flex-col items-center justify-center h-full text-white px-8 bg-gradient-to-br ${config.gradient}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-4 opacity-80"
      >
        {config.icon}
      </motion.div>

      <motion.p
        className="text-sm font-medium uppercase tracking-widest opacity-70 mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.7, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {config.label}
      </motion.p>

      {isFinalScreen ? (
        <CircularProgress score={numericValue} active={active} />
      ) : config.isCountUp ? (
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        >
          <span className="text-6xl font-bold tabular-nums">
            {animatedNumber}
          </span>
          {config.suffix && (
            <span className="text-2xl font-medium ml-2 opacity-80">
              {config.suffix}
            </span>
          )}
        </motion.div>
      ) : (
        <motion.p
          className="text-2xl font-bold text-center max-w-xs leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {rawValue}
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Share card                                                         */
/* ------------------------------------------------------------------ */

function ShareCard({ data }: { data: WrappedData }) {
  return (
    <div
      className="bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] rounded-2xl p-6
                    text-white max-w-sm mx-auto shadow-xl"
    >
      <h3 className="text-lg font-bold mb-4 text-center">
        My Study Wrapped
      </h3>
      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <div className="bg-white/10 rounded-lg py-2 px-3">
          <p className="text-2xl font-bold">{data.totalHoursStudied}h</p>
          <p className="opacity-70 text-xs">Hours</p>
        </div>
        <div className="bg-white/10 rounded-lg py-2 px-3">
          <p className="text-2xl font-bold">{data.topicsMastered}</p>
          <p className="opacity-70 text-xs">Topics</p>
        </div>
        <div className="bg-white/10 rounded-lg py-2 px-3">
          <p className="text-2xl font-bold">{data.questionsAnswered}</p>
          <p className="opacity-70 text-xs">Questions</p>
        </div>
        <div className="bg-white/10 rounded-lg py-2 px-3">
          <p className="text-2xl font-bold">{data.readinessScore}%</p>
          <p className="opacity-70 text-xs">Readiness</p>
        </div>
      </div>
      <p className="text-center text-xs opacity-60 mt-3">
        The Adaptive Brain
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const TOTAL_SCREENS = screens.length; // 8
const AUTO_ADVANCE_MS = 4000;

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

export default function StudyWrapped({ wrappedData }: StudyWrappedProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLastScreen = currentScreen === TOTAL_SCREENS - 1;
  const showShareCard = currentScreen === TOTAL_SCREENS; // after all screens

  /* ---- navigation ---- */
  const goNext = useCallback(() => {
    if (currentScreen >= TOTAL_SCREENS) return;
    setDirection(1);
    setCurrentScreen((s) => s + 1);
  }, [currentScreen]);

  const goPrev = useCallback(() => {
    if (currentScreen <= 0) return;
    setDirection(-1);
    setCurrentScreen((s) => s - 1);
  }, [currentScreen]);

  /* ---- auto-advance ---- */
  useEffect(() => {
    if (paused || showShareCard) return;

    timerRef.current = setTimeout(goNext, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentScreen, paused, showShareCard, goNext]);

  /* ---- touch / click to advance ---- */
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goPrev();
    } else {
      goNext();
    }
    // Pause auto-advance on manual interaction
    setPaused(true);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Screen content */}
      <div
        className="flex-1 relative overflow-hidden cursor-pointer"
        onClick={!showShareCard ? handleClick : undefined}
      >
        <AnimatePresence mode="wait" custom={direction}>
          {showShareCard ? (
            <motion.div
              key="share"
              className="absolute inset-0 flex flex-col items-center justify-center
                         bg-gradient-to-br from-[#6C63FF] to-[#4F46E5] px-6"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <motion.h2
                className="text-white text-2xl font-bold mb-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Your Journey
              </motion.h2>

              <ShareCard data={wrappedData} />

              <motion.div
                className="mt-8 flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm
                             rounded-xl text-white text-sm font-medium
                             hover:bg-white/30 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // In a real app this would trigger a share sheet or copy
                    if (navigator.share) {
                      navigator.share({
                        title: 'My Study Wrapped',
                        text: `I studied ${wrappedData.totalHoursStudied} hours and mastered ${wrappedData.topicsMastered} topics!`,
                      });
                    }
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                <Link
                  href="/project/new"
                  className="flex items-center gap-2 px-8 py-3.5 bg-white text-[#6C63FF]
                             rounded-xl font-semibold text-sm shadow-lg
                             hover:bg-gray-50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  Start Next Project
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key={currentScreen}
              className="absolute inset-0"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <WrappedScreen
                config={screens[currentScreen]}
                data={wrappedData}
                active={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-4 bg-black/50 backdrop-blur-sm">
        {Array.from({ length: TOTAL_SCREENS + 1 }).map((_, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDirection(i > currentScreen ? 1 : -1);
              setCurrentScreen(i);
              setPaused(true);
            }}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              i === currentScreen
                ? 'w-6 h-2 bg-white'
                : 'w-2 h-2 bg-white/40'
            }`}
            whileTap={{ scale: 0.8 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
