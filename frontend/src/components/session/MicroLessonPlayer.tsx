'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Play, Pause, Eye } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MicroLesson {
  id: string;
  title: string;
  content: string;
  type: 'content' | 'quiz';
  quiz_data?: {
    question: string;
    options: string[];
    correct_index: number;
    explanation?: string;
  };
}

interface MicroLessonPlayerProps {
  lessons: MicroLesson[];
  /** Auto-advance timer in seconds (0 = disabled) */
  autoAdvanceSeconds?: number;
  onComplete?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Content Slide                                                      */
/* ------------------------------------------------------------------ */

function ContentSlide({ lesson }: { lesson: MicroLesson }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 leading-tight"
      >
        {lesson.title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="text-base sm:text-lg text-gray-600 max-w-md leading-relaxed"
      >
        {lesson.content}
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quiz Slide                                                         */
/* ------------------------------------------------------------------ */

function QuizSlide({ lesson }: { lesson: MicroLesson }) {
  const quiz = lesson.quiz_data;
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (!quiz) return null;

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
  };

  const isCorrect = selected === quiz.correct_index;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl sm:text-2xl font-bold text-gray-900 mb-8 text-center leading-tight"
      >
        {quiz.question}
      </motion.h2>

      <div className="w-full max-w-md space-y-3">
        {quiz.options.map((option, idx) => {
          let bg = 'bg-white border-gray-200 hover:border-[#6C63FF]';
          if (revealed && idx === quiz.correct_index) {
            bg = 'bg-green-50 border-[#22C55E]';
          } else if (revealed && idx === selected && !isCorrect) {
            bg = 'bg-red-50 border-red-400';
          } else if (selected === idx && !revealed) {
            bg = 'bg-[#6C63FF]/10 border-[#6C63FF]';
          }

          return (
            <motion.button
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors font-medium text-gray-800 ${bg}`}
            >
              {option}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-6 px-5 py-3 rounded-xl text-sm font-medium ${
              isCorrect
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {isCorrect ? 'Correct!' : 'Not quite.'}{' '}
            {quiz.explanation && (
              <span className="text-gray-600">{quiz.explanation}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Player                                                        */
/* ------------------------------------------------------------------ */

export default function MicroLessonPlayer({
  lessons,
  autoAdvanceSeconds = 0,
  onComplete,
}: MicroLessonPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(autoAdvanceSeconds > 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState(autoAdvanceSeconds);

  const total = lessons.length;

  /* ---- navigation ---- */
  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(total - 1, idx));
      setActiveIndex(clamped);
      setCountdown(autoAdvanceSeconds);
      if (clamped === total - 1 && onComplete) onComplete();
    },
    [total, autoAdvanceSeconds, onComplete],
  );

  /* ---- scroll-snap observer ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const index = Math.round(el.scrollTop / el.clientHeight);
      if (index !== activeIndex) {
        setActiveIndex(index);
        setCountdown(autoAdvanceSeconds);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeIndex, autoAdvanceSeconds]);

  /* ---- auto-advance timer ---- */
  useEffect(() => {
    if (!autoPlay || autoAdvanceSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setActiveIndex((cur) => {
            const next = cur + 1;
            if (next >= total) {
              setAutoPlay(false);
              if (onComplete) onComplete();
              return cur;
            }
            // scroll into view
            scrollRef.current?.children[next]?.scrollIntoView({
              behavior: 'smooth',
            });
            return next;
          });
          return autoAdvanceSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoPlay, autoAdvanceSeconds, total, onComplete]);

  /* ---- sync scroll when activeIndex set programmatically ---- */
  useEffect(() => {
    const child = scrollRef.current?.children[activeIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth' });
  }, [activeIndex]);

  const currentLesson = lessons[activeIndex];
  const nextLesson = activeIndex < total - 1 ? lessons[activeIndex + 1] : null;

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-[#F8F9FA] overflow-hidden select-none">
      {/* -------- Scroll container -------- */}
      <div
        ref={scrollRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {lessons.map((lesson, idx) => (
          <div
            key={lesson.id}
            className="w-full h-full flex-shrink-0 snap-start snap-always flex items-center justify-center"
            style={{ minHeight: '100dvh' }}
          >
            {lesson.type === 'quiz' ? (
              <QuizSlide lesson={lesson} />
            ) : (
              <ContentSlide lesson={lesson} />
            )}
          </div>
        ))}
      </div>

      {/* -------- Progress dots (right side) -------- */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
        {lessons.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Go to slide ${idx + 1}`}
            onClick={() => goTo(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              idx === activeIndex
                ? 'bg-[#6C63FF] scale-125'
                : idx < activeIndex
                  ? 'bg-[#6C63FF]/40'
                  : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* -------- Top bar: counter + auto-advance -------- */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-5 z-20">
        <span className="text-xs font-semibold text-gray-500 bg-white/80 backdrop-blur rounded-full px-3 py-1">
          {activeIndex + 1} / {total}
        </span>

        {autoAdvanceSeconds > 0 && (
          <button
            onClick={() => setAutoPlay((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-white/80 backdrop-blur rounded-full px-3 py-1 hover:bg-white transition-colors"
          >
            {autoPlay ? (
              <>
                <Pause className="w-3.5 h-3.5" /> {countdown}s
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Auto
              </>
            )}
          </button>
        )}
      </div>

      {/* -------- Navigation arrows -------- */}
      {activeIndex > 0 && (
        <button
          onClick={() => goTo(activeIndex - 1)}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 p-2 rounded-full bg-white/70 backdrop-blur shadow hover:bg-white transition-colors"
          aria-label="Previous"
        >
          <ChevronUp className="w-5 h-5 text-gray-600" />
        </button>
      )}
      {activeIndex < total - 1 && (
        <button
          onClick={() => goTo(activeIndex + 1)}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 p-2 rounded-full bg-white/70 backdrop-blur shadow hover:bg-white transition-colors animate-bounce"
          aria-label="Next"
        >
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* -------- "Just one more" teaser -------- */}
      <AnimatePresence>
        {nextLesson && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg cursor-pointer hover:bg-white transition-colors"
            onClick={() => goTo(activeIndex + 1)}
          >
            <Eye className="w-4 h-4 text-[#6C63FF]" />
            <span className="text-xs font-medium text-gray-600">
              Up next:{' '}
              <span className="text-[#6C63FF] font-semibold">
                {nextLesson.title}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
