'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, ChevronRight, Pause, Play } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FocusContent {
  id: string;
  title: string;
  body: string;
}

interface SessionData {
  id: string;
  project_id: string;
  content_blocks: FocusContent[];
}

/* ------------------------------------------------------------------ */
/*  Ambient gradient backgrounds                                       */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  'radial-gradient(ellipse at 20% 50%, rgba(108,99,255,0.08) 0%, rgba(248,249,250,0) 70%)',
  'radial-gradient(ellipse at 80% 30%, rgba(34,197,94,0.06) 0%, rgba(248,249,250,0) 70%)',
  'radial-gradient(ellipse at 50% 80%, rgba(255,107,53,0.06) 0%, rgba(248,249,250,0) 70%)',
  'radial-gradient(ellipse at 30% 20%, rgba(108,99,255,0.06) 0%, rgba(248,249,250,0) 70%)',
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Growing visual element                                             */
/* ------------------------------------------------------------------ */

function GrowingCircle({ seconds }: { seconds: number }) {
  // Scale from 0.3 up to 1.0 over ~30 minutes (1800 seconds)
  const progress = Math.min(seconds / 1800, 1);
  const scale = 0.3 + progress * 0.7;
  const opacity = 0.15 + progress * 0.25;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      <motion.div
        animate={{ scale, opacity }}
        transition={{ duration: 2, ease: 'easeOut' }}
        className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(34,197,94,0.08) 50%, transparent 70%)',
        }}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary overlay                                                    */
/* ------------------------------------------------------------------ */

interface SummaryData {
  totalSeconds: number;
  focusedSeconds: number;
  contentCovered: number;
  focusScore: number;
}

function SummaryOverlay({
  data,
  onClose,
}: {
  data: SummaryData;
  onClose: () => void;
}) {
  const getScoreColor = (score: number) =>
    score >= 80 ? '#22C55E' : score >= 50 ? '#EAB308' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        <Card className="max-w-sm w-full text-center py-10 px-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${getScoreColor(data.focusScore)}20` }}
          >
            <span
              className="text-2xl font-bold"
              style={{ color: getScoreColor(data.focusScore) }}
            >
              {data.focusScore}%
            </span>
          </motion.div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Focus Session Complete
          </h2>
          <p className="text-sm text-gray-500 mb-8">Great work staying focused!</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatTimer(data.totalSeconds)}
              </p>
              <p className="text-xs text-gray-500">Total time</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {formatTimer(data.focusedSeconds)}
              </p>
              <p className="text-xs text-gray-500">Focused</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{data.contentCovered}</p>
              <p className="text-xs text-gray-500">Blocks</p>
            </div>
          </div>

          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Focus Page                                                         */
/* ------------------------------------------------------------------ */

export default function FocusPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  /* State */
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [focusedTime, setFocusedTime] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);

  // Tab-visibility tracking
  const isVisibleRef = useRef(true);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  /* ---- Fetch session data ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load session');
        const data = await res.json();
        if (!cancelled) {
          setSessionData({
            id: data.id ?? sessionId,
            project_id: data.project_id ?? '',
            content_blocks: data.content_blocks ?? [
              {
                id: '1',
                title: data.session_type ?? 'Focus Session',
                body: 'Focus on your study material. Content will appear here as it loads.',
              },
            ],
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          // Fallback when API is unavailable
          setSessionData({
            id: sessionId,
            project_id: '',
            content_blocks: [
              {
                id: 'fallback',
                title: 'Focus Mode',
                body: 'Take a deep breath and focus on your study material.',
              },
            ],
          });
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /* ---- Timer ---- */
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && isVisibleRef.current) {
        setElapsed((p) => p + 1);
        setFocusedTime((p) => p + 1);
      } else if (!pausedRef.current) {
        // Tab hidden but not user-paused - counts as elapsed but not focused
        setElapsed((p) => p + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---- Tab visibility tracking ---- */
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  /* ---- Ambient gradient cycling ---- */
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((p) => (p + 1) % GRADIENTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Handlers ---- */
  const handleEndSession = useCallback(() => {
    const focusScore =
      elapsed > 0 ? Math.round((focusedTime / elapsed) * 100) : 100;
    setShowSummary(true);
  }, [elapsed, focusedTime]);

  const blocks = sessionData?.content_blocks ?? [];
  const currentBlock = blocks[currentBlockIdx];

  const nextBlock = () => {
    if (currentBlockIdx < blocks.length - 1) {
      setCurrentBlockIdx((p) => p + 1);
    }
  };

  const prevBlock = () => {
    if (currentBlockIdx > 0) {
      setCurrentBlockIdx((p) => p - 1);
    }
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <div className="w-8 h-8 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const focusScore =
    elapsed > 0 ? Math.round((focusedTime / elapsed) * 100) : 100;

  return (
    <div className="relative min-h-screen bg-[#F8F9FA] overflow-hidden select-none">
      {/* ---- Ambient gradient ---- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={bgIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3 }}
          className="fixed inset-0 pointer-events-none"
          style={{ backgroundImage: GRADIENTS[bgIndex] }}
        />
      </AnimatePresence>

      {/* ---- Growing visual ---- */}
      <GrowingCircle seconds={focusedTime} />

      {/* ---- Timer (subtle, top-right corner) ---- */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={() => setPaused((p) => !p)}
          className="p-2 rounded-full bg-white/60 backdrop-blur text-gray-500 hover:bg-white/80 transition-colors"
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur text-sm">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-gray-500 text-xs">
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>

      {/* ---- End session button (subtle, top-left) ---- */}
      <button
        onClick={handleEndSession}
        className="fixed top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur text-xs font-medium text-gray-500 hover:bg-white/80 hover:text-gray-700 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
        End
      </button>

      {/* ---- Main content ---- */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-20">
        <AnimatePresence mode="wait">
          {currentBlock && (
            <motion.div
              key={currentBlock.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="max-w-lg text-center"
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 leading-tight">
                {currentBlock.title}
              </h1>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                {currentBlock.body}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Minimal bottom navigation ---- */}
      {blocks.length > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4">
          {currentBlockIdx > 0 && (
            <button
              onClick={prevBlock}
              className="p-2.5 rounded-full bg-white/70 backdrop-blur shadow-sm hover:bg-white transition-colors"
              aria-label="Previous block"
            >
              <ChevronRight className="w-5 h-5 text-gray-500 rotate-180" />
            </button>
          )}

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {blocks.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentBlockIdx
                    ? 'bg-[#6C63FF] w-4'
                    : idx < currentBlockIdx
                      ? 'bg-[#6C63FF]/40'
                      : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {currentBlockIdx < blocks.length - 1 && (
            <button
              onClick={nextBlock}
              className="p-2.5 rounded-full bg-white/70 backdrop-blur shadow-sm hover:bg-white transition-colors"
              aria-label="Next block"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* ---- Paused overlay ---- */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <button
                onClick={() => setPaused(false)}
                className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
              >
                <Play className="w-8 h-8 text-[#6C63FF] ml-1" />
              </button>
              <p className="text-sm text-white font-medium mt-4">Paused</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Summary overlay ---- */}
      <AnimatePresence>
        {showSummary && (
          <SummaryOverlay
            data={{
              totalSeconds: elapsed,
              focusedSeconds: focusedTime,
              contentCovered: currentBlockIdx + 1,
              focusScore,
            }}
            onClose={() => router.back()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
