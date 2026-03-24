'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { reviewsApi } from '@/lib/api';
import AuthGuard from '@/components/auth/AuthGuard';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Loader';

interface ReviewCard {
  id: string;
  question_id: string;
  question_text: string;
  correct_answer: string;
  topic_name: string;
  difficulty: string;
  due_at: string;
}

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    async function fetchDue() {
      try {
        const data = await reviewsApi.getDue() as { cards: ReviewCard[] };
        setCards(data.cards ?? []);
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDue();
  }, []);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const allDone = currentIndex >= totalCards;

  const handleFlip = useCallback(() => {
    if (!answered) {
      setIsFlipped((prev) => !prev);
    }
  }, [answered]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentCard || !userAnswer.trim()) return;
    const correct =
      userAnswer.trim().toLowerCase() ===
      currentCard.correct_answer.trim().toLowerCase();
    setIsCorrect(correct);
    setAnswered(true);
    setIsFlipped(true);
  }, [currentCard, userAnswer]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!currentCard || submitting) return;
      setSubmitting(true);
      try {
        await reviewsApi.submitAttempt({
          question_id: currentCard.question_id,
          quality_score: quality,
        });
      } catch {
        // continue even on error
      }
      setCompletedCount((p) => p + 1);
      setCurrentIndex((p) => p + 1);
      setIsFlipped(false);
      setUserAnswer('');
      setAnswered(false);
      setIsCorrect(false);
      setSubmitting(false);
    },
    [currentCard, submitting]
  );

  const handleAutoRate = useCallback(() => {
    handleRate(isCorrect ? 4 : 1);
  }, [handleRate, isCorrect]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#F8F9FA]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Spaced Repetition Review
            </h1>
            {!loading && !allDone && (
              <p className="text-gray-500">
                {totalCards - completedCount} card{totalCards - completedCount !== 1 ? 's' : ''} due for review
              </p>
            )}
          </div>

          {/* Progress */}
          {!loading && totalCards > 0 && !allDone && (
            <div className="mb-6">
              <ProgressBar
                value={completedCount}
                max={totalCards}
                className="h-2 rounded-full"
              />
              <p className="text-sm text-gray-400 mt-1 text-right">
                {completedCount} / {totalCards}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : allDone || totalCards === 0 ? (
            <EmptyState
              icon={
                <div className="w-20 h-20 bg-[#22C55E]/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-[#22C55E]" />
                </div>
              }
              title="All caught up!"
              description="You have no reviews due right now. Great job staying on top of your studies!"
              actionLabel="Back to Dashboard"
              onAction={() => (window.location.href = '/dashboard')}
            />
          ) : currentCard ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                {/* Topic badge */}
                <div className="mb-4">
                  <span className="inline-block bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-semibold px-3 py-1 rounded-full">
                    {currentCard.topic_name}
                  </span>
                </div>

                {/* Flashcard with 3D flip */}
                <div
                  className="relative w-full h-64 md:h-80 cursor-pointer mb-6"
                  style={{ perspective: '1000px' }}
                  onClick={handleFlip}
                >
                  <motion.div
                    className="relative w-full h-full"
                    style={{ transformStyle: 'preserve-3d' }}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  >
                    {/* Front */}
                    <div
                      className="absolute inset-0 rounded-2xl bg-white shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <RotateCcw className="w-5 h-5 text-gray-300 absolute top-4 right-4" />
                      <p className="text-lg md:text-xl font-semibold text-gray-900 text-center">
                        {currentCard.question_text}
                      </p>
                      <p className="text-sm text-gray-400 mt-4">Tap to reveal answer</p>
                    </div>

                    {/* Back */}
                    <div
                      className="absolute inset-0 rounded-2xl bg-white shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <p className="text-lg md:text-xl font-semibold text-[#6C63FF] text-center">
                        {currentCard.correct_answer}
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* Answer input */}
                {!answered && (
                  <div className="flex gap-3 mb-6">
                    <input
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer (optional)..."
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:border-[#6C63FF] focus:outline-none transition-colors"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && userAnswer.trim()) {
                          handleCheckAnswer();
                        }
                      }}
                    />
                    {userAnswer.trim() && (
                      <Button
                        onClick={handleCheckAnswer}
                        className="bg-[#6C63FF] hover:bg-[#5B54E6] text-white px-6 rounded-xl font-semibold transition-colors"
                      >
                        Check
                      </Button>
                    )}
                  </div>
                )}

                {/* Answer feedback */}
                {answered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${
                      isCorrect ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-[#22C55E]" />
                    ) : (
                      <XCircle className="w-6 h-6 text-[#EF4444]" />
                    )}
                    <span
                      className={`font-semibold ${
                        isCorrect ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isCorrect ? 'Correct!' : 'Not quite'}
                    </span>
                  </motion.div>
                )}

                {/* Rating buttons */}
                {isFlipped && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                  >
                    {answered ? (
                      <Button
                        onClick={handleAutoRate}
                        disabled={submitting}
                        className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
                      >
                        {submitting ? 'Saving...' : 'Next Card'}
                      </Button>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 text-center font-medium">
                          How well did you know this?
                        </p>
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => handleRate(rating)}
                              disabled={submitting}
                              className="group flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-[#6C63FF]/5 transition-colors disabled:opacity-50"
                            >
                              <Star
                                className={`w-8 h-8 transition-colors ${
                                  rating <= 2
                                    ? 'text-[#EF4444] group-hover:fill-[#EF4444]'
                                    : rating === 3
                                    ? 'text-yellow-400 group-hover:fill-yellow-400'
                                    : 'text-[#22C55E] group-hover:fill-[#22C55E]'
                                }`}
                              />
                              <span className="text-xs text-gray-400">
                                {rating === 1
                                  ? 'Again'
                                  : rating === 2
                                  ? 'Hard'
                                  : rating === 3
                                  ? 'Okay'
                                  : rating === 4
                                  ? 'Good'
                                  : 'Easy'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </div>
    </AuthGuard>
  );
}
