'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowRight, Award, Target, Coffee } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { useProfileStore } from '@/stores/profileStore';
import { wellbeingApi } from '@/lib/api';
import { ContentBlock, QuizQuestion, SessionWrapUp as SessionWrapUpType } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import Loader from '@/components/ui/Loader';
import ContentDisplay from '@/components/session/ContentDisplay';
import QuizInterface from '@/components/session/QuizInterface';
import SessionWrapUpComponent from '@/components/session/SessionWrapUp';
import CheckInModal from '@/components/wellbeing/CheckInModal';
import BreathingExercise from '@/components/wellbeing/BreathingExercise';

type Phase = 'intro' | 'content' | 'quiz' | 'topic_complete' | 'wrap_up';

interface TopicResult {
  topicName: string;
  correct: number;
  total: number;
}

export default function StudySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const {
    session,
    currentTopicIndex,
    topics,
    loading,
    error,
    fetchSession,
    getContentBlocks,
    getQuizQuestions,
    completeSession,
    wrapUp,
  } = useSessionStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [topicResults, setTopicResults] = useState<TopicResult[]>([]);
  const [currentContent, setCurrentContent] = useState<ContentBlock[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestion[]>([]);
  const [lastTopicResult, setLastTopicResult] = useState<TopicResult | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(true);
  const [showBreakBanner, setShowBreakBanner] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [breakDismissed, setBreakDismissed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch session on mount
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  // Get user attention span for break reminders
  const profile = useProfileStore((s) => s.profile);
  const attentionSpanMinutes = profile?.attention_span_minutes ?? 25;

  // Elapsed time timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Show break banner at ~75% of attention span
  useEffect(() => {
    if (breakDismissed || showBreakBanner) return;
    const breakThresholdSeconds = Math.floor(attentionSpanMinutes * 60 * 0.75);
    if (elapsedSeconds >= breakThresholdSeconds) {
      setShowBreakBanner(true);
    }
  }, [elapsedSeconds, attentionSpanMinutes, breakDismissed, showBreakBanner]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const currentTopic = topics?.[currentTopicIndex] ?? null;
  const totalTopics = topics?.length ?? 0;
  const completedTopics = topicResults.length;
  const isLastTopic = currentTopicIndex >= totalTopics - 1;

  const handleCheckInSubmit = useCallback(
    async (mood: string, energy: string) => {
      setShowCheckIn(false);
      try {
        await wellbeingApi.checkin(sessionId, { mood, energy_level: energy });
      } catch {
        // non-blocking
      }
    },
    [sessionId]
  );

  const handleCheckInClose = useCallback(() => {
    setShowCheckIn(false);
  }, []);

  const handleTakeBreak = useCallback(() => {
    setShowBreakBanner(false);
    setShowBreathing(true);
    // Pause the timer during break
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleBreathingComplete = useCallback(() => {
    setShowBreathing(false);
    setBreakDismissed(true);
    // Resume the timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const handleDismissBreak = useCallback(() => {
    setShowBreakBanner(false);
    setBreakDismissed(true);
  }, []);

  const handleBeginSession = useCallback(async () => {
    if (!currentTopic) return;
    const blocks = await getContentBlocks(sessionId, currentTopic.id);
    setCurrentContent(blocks);
    setPhase('content');
  }, [currentTopic, getContentBlocks, sessionId]);

  const handleContentComplete = useCallback(async () => {
    if (!currentTopic) return;
    const questions = await getQuizQuestions(sessionId, currentTopic.id);
    setCurrentQuestions(questions);
    setPhase('quiz');
  }, [currentTopic, getQuizQuestions, sessionId]);

  const handleQuizComplete = useCallback(
    (results: { correct: number; total: number }) => {
      const result: TopicResult = {
        topicName: currentTopic?.name ?? 'Unknown Topic',
        correct: results.correct,
        total: results.total,
      };
      setLastTopicResult(result);
      setTopicResults((prev) => [...prev, result]);
      setPhase('topic_complete');
    },
    [currentTopic]
  );

  const handleNextTopic = useCallback(async () => {
    const nextIndex = currentTopicIndex + 1;
    if (nextIndex < totalTopics) {
      useSessionStore.setState({ currentTopicIndex: nextIndex });
      const nextTopic = topics[nextIndex];
      const blocks = await getContentBlocks(sessionId, nextTopic.id);
      setCurrentContent(blocks);
      setPhase('content');
    }
  }, [currentTopicIndex, totalTopics, topics, getContentBlocks, sessionId]);

  const handleFinishSession = useCallback(async () => {
    await completeSession(sessionId, elapsedSeconds);
    setPhase('wrap_up');
  }, [completeSession, sessionId, elapsedSeconds]);

  const handleWrapUpClose = useCallback(() => {
    if (session?.projectId) {
      router.push(`/projects/${session.projectId}`);
    } else {
      router.push('/dashboard');
    }
  }, [router, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <p className="text-[#EF4444] text-lg font-medium mb-4">Something went wrong</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Wellbeing check-in modal at session start */}
      <CheckInModal
        isOpen={showCheckIn && phase === 'intro'}
        onClose={handleCheckInClose}
        onSubmit={handleCheckInSubmit}
      />

      {/* Break banner */}
      <AnimatePresence>
        {showBreakBanner && !showBreathing && (
          <motion.div
            initial={{ opacity: 0, y: -60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="bg-white rounded-xl shadow-lg border border-[#6C63FF]/20 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#6C63FF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Coffee className="w-5 h-5 text-[#6C63FF]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">
                    Time for a quick break?
                  </p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    You&apos;ve been studying for a while. A short break can help you focus better.
                  </p>
                  <div className="flex gap-3 mt-3">
                    <Button
                      onClick={handleTakeBreak}
                      className="bg-[#6C63FF] hover:bg-[#5B54E6] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Take a Break
                    </Button>
                    <button
                      onClick={handleDismissBreak}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breathing exercise overlay */}
      <AnimatePresence>
        {showBreathing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                Take a Breather
              </h2>
              <p className="text-gray-500 text-center mb-6 text-sm">
                Follow the circle to calm your mind
              </p>
              <BreathingExercise duration={1} onComplete={handleBreathingComplete} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top progress bar and timer */}
      {phase !== 'wrap_up' && (
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">
                Topic {Math.min(completedTopics + 1, totalTopics)} of {totalTopics}
              </span>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{formatTime(elapsedSeconds)}</span>
              </div>
            </div>
            <ProgressBar
              value={completedTopics}
              max={totalTopics}
              className="h-2 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* INTRO PHASE */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-8 md:p-10">
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="w-16 h-16 bg-[#6C63FF]/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  >
                    <Target className="w-8 h-8 text-[#6C63FF]" />
                  </motion.div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    Today&apos;s Study Session
                  </h1>
                  <p className="text-gray-500">
                    {session?.title ?? 'Ready to learn something new'}
                  </p>
                </div>

                <div className="mb-8">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Topics we&apos;ll cover
                  </p>
                  <div className="space-y-3">
                    {topics?.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <span className="w-8 h-8 bg-[#6C63FF] text-white rounded-lg flex items-center justify-center text-sm font-semibold">
                          {i + 1}
                        </span>
                        <span className="text-gray-800 font-medium">{topic.name}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleBeginSession}
                  className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
                >
                  Let&apos;s Begin
                  <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                </Button>
              </Card>
            </motion.div>
          )}

          {/* CONTENT PHASE */}
          {phase === 'content' && (
            <motion.div
              key={`content-${currentTopicIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <ContentDisplay
                contentBlocks={currentContent}
                onComplete={handleContentComplete}
              />
            </motion.div>
          )}

          {/* QUIZ PHASE */}
          {phase === 'quiz' && (
            <motion.div
              key={`quiz-${currentTopicIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <QuizInterface
                questions={currentQuestions}
                sessionId={sessionId}
                onComplete={handleQuizComplete}
              />
            </motion.div>
          )}

          {/* TOPIC COMPLETE PHASE */}
          {phase === 'topic_complete' && lastTopicResult && (
            <motion.div
              key={`topic-complete-${currentTopicIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-8 md:p-10 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-6 bg-[#22C55E]/10 rounded-full flex items-center justify-center"
                >
                  <Award className="w-10 h-10 text-[#22C55E]" />
                </motion.div>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Topic Complete!
                </h2>
                <p className="text-gray-500 mb-6">{lastTopicResult.topicName}</p>

                <div className="inline-flex items-center gap-2 bg-gray-50 rounded-2xl px-6 py-4 mb-8">
                  <span className="text-3xl font-bold text-[#6C63FF]">
                    {lastTopicResult.correct}
                  </span>
                  <span className="text-lg text-gray-400">/</span>
                  <span className="text-3xl font-bold text-gray-300">
                    {lastTopicResult.total}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">correct</span>
                </div>

                <div>
                  {isLastTopic ? (
                    <Button
                      onClick={handleFinishSession}
                      className="w-full bg-[#FF6B35] hover:bg-[#E55A25] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
                    >
                      Finish Session
                      <Award className="w-5 h-5 ml-2 inline-block" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNextTopic}
                      className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
                    >
                      Next Topic
                      <ArrowRight className="w-5 h-5 ml-2 inline-block" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* WRAP UP PHASE */}
          {phase === 'wrap_up' && wrapUp && (
            <motion.div
              key="wrap-up"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <SessionWrapUpComponent wrapUp={wrapUp} onClose={handleWrapUpClose} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
