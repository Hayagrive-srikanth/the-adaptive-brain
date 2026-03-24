'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Lightbulb, ArrowRight, RefreshCw } from 'lucide-react';
import { QuizQuestion, QuizFeedback } from '@/types';
import { useSessionStore } from '@/stores/sessionStore';
import { quizApi } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

interface QuizInterfaceProps {
  questions: QuizQuestion[];
  sessionId: string;
  onComplete: (results: { correct: number; total: number }) => void;
}

/** Normalize options — API may return an object {A: "...", B: "..."} or an array */
function getOptionsArray(options: any): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'object') return Object.values(options);
  return [];
}

export default function QuizInterface({
  questions,
  sessionId,
  onComplete,
}: QuizInterfaceProps) {
  const submitAnswer = useSessionStore((s) => s.submitAnswer);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [fillBlankValue, setFillBlankValue] = useState('');
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rephraseExplanation, setRephraseExplanation] = useState<string | null>(null);
  const [rephraseCount, setRephraseCount] = useState(0);
  const [isLoadingRephrase, setIsLoadingRephrase] = useState(false);
  const [progressiveHints, setProgressiveHints] = useState<string[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  const question = questions[currentIndex];
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex >= totalQuestions - 1;
  const hints = question?.hints ?? [];
  const hintsRemaining = hints.length - hintsRevealed;

  const resetForNextQuestion = useCallback(() => {
    setSelectedAnswer(null);
    setFillBlankValue('');
    setFeedback(null);
    setShowFeedback(false);
    setHintsRevealed(0);
    setIsSubmitting(false);
    setRephraseExplanation(null);
    setRephraseCount(0);
    setProgressiveHints([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    const answer =
      question.question_type === 'fill_blank' ? fillBlankValue : selectedAnswer;
    if (!answer) return;

    setIsSubmitting(true);
    try {
      const raw: any = await submitAnswer({
        session_id: sessionId,
        question_id: question.id,
        user_answer: answer,
        hints_used: hintsRevealed,
      });
      // Normalize: backend returns "correct", frontend expects "is_correct"
      const result: QuizFeedback = {
        ...raw,
        is_correct: raw.is_correct ?? raw.correct ?? false,
      };
      setFeedback(result);
      setShowFeedback(true);
      if (result.is_correct) {
        setCorrectCount((p) => p + 1);
      }
    } catch {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    question,
    fillBlankValue,
    selectedAnswer,
    submitAnswer,
    sessionId,
  ]);

  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      const finalCorrect = correctCount;
      onComplete({ correct: finalCorrect, total: totalQuestions });
    } else {
      setCurrentIndex((p) => p + 1);
      resetForNextQuestion();
    }
  }, [isLastQuestion, correctCount, totalQuestions, onComplete, resetForNextQuestion]);

  const handleRevealHint = useCallback(() => {
    if (hintsRevealed < hints.length) {
      setHintsRevealed((p) => p + 1);
    }
  }, [hintsRevealed, hints.length]);

  const handleFetchProgressiveHint = useCallback(async () => {
    if (!question || isLoadingHint) return;
    setIsLoadingHint(true);
    try {
      const result = await quizApi.hint(question.id, progressiveHints.length) as { hint: string };
      setProgressiveHints((prev) => [...prev, result.hint]);
    } catch {
      // silently fail
    } finally {
      setIsLoadingHint(false);
    }
  }, [question, isLoadingHint, progressiveHints.length]);

  const handleRephrase = useCallback(async () => {
    if (!question || isLoadingRephrase) return;
    setIsLoadingRephrase(true);
    try {
      const result = await quizApi.rephrase(question.id) as {
        explanation: string;
        new_question?: QuizQuestion;
      };
      setRephraseExplanation(result.explanation);
      setRephraseCount((p) => p + 1);

      // If a new question is returned for the same concept, inject it
      if (result.new_question) {
        questions.splice(currentIndex + 1, 0, result.new_question);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingRephrase(false);
    }
  }, [question, isLoadingRephrase, questions, currentIndex]);

  if (!question) return null;

  const hasAnswer =
    question.question_type === 'fill_blank'
      ? fillBlankValue.trim().length > 0
      : selectedAnswer !== null;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500 font-medium">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span>
            {correctCount} correct so far
          </span>
        </div>
        <ProgressBar
          value={currentIndex + (showFeedback ? 1 : 0)}
          max={totalQuestions}
          className="h-2 rounded-full"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        >
          {/* Question card */}
          <Card className="p-6 md:p-8 relative overflow-hidden">
            {/* Feedback overlay */}
            <AnimatePresence>
              {showFeedback && feedback && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 z-10 ${
                    feedback.is_correct
                      ? 'bg-[#22C55E]/5'
                      : 'bg-[#EF4444]/5'
                  }`}
                />
              )}
            </AnimatePresence>

            <div className="relative z-20">
              <p className="text-lg md:text-xl font-semibold text-gray-900 mb-6">
                {question.question_text}
              </p>

              {/* Multiple choice (also handles true_false stored as MCQ) */}
              {(question.question_type === 'multiple_choice' ||
                (question.question_type === 'true_false' && getOptionsArray(question.options).length > 0)) && (
                <div className="space-y-3">
                  {getOptionsArray(question.options).map((option, i) => {
                    const isSelected = selectedAnswer === option;
                    const showCorrectHighlight =
                      showFeedback && feedback && option === feedback.correct_answer;
                    const showIncorrectHighlight =
                      showFeedback &&
                      feedback &&
                      !feedback.is_correct &&
                      isSelected;

                    return (
                      <button
                        key={i}
                        onClick={() => !showFeedback && setSelectedAnswer(option)}
                        disabled={showFeedback}
                        className={`w-full text-left min-h-[48px] p-4 rounded-xl border-2 transition-all duration-200 ${
                          showCorrectHighlight
                            ? 'border-[#22C55E] bg-[#22C55E]/5'
                            : showIncorrectHighlight
                            ? 'border-[#EF4444] bg-[#EF4444]/5'
                            : isSelected
                            ? 'border-[#6C63FF] bg-[#6C63FF]/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span className="text-gray-800 font-medium">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True / False (only when no options provided — pure true/false) */}
              {question.question_type === 'true_false' && getOptionsArray(question.options).length === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {['True', 'False'].map((val) => {
                    const isSelected = selectedAnswer === val;
                    const showCorrectHighlight =
                      showFeedback && feedback && val === feedback.correct_answer;
                    const showIncorrectHighlight =
                      showFeedback &&
                      feedback &&
                      !feedback.is_correct &&
                      isSelected;

                    return (
                      <button
                        key={val}
                        onClick={() => !showFeedback && setSelectedAnswer(val)}
                        disabled={showFeedback}
                        className={`py-4 rounded-xl border-2 text-lg font-semibold transition-all duration-200 ${
                          showCorrectHighlight
                            ? 'border-[#22C55E] bg-[#22C55E]/5 text-[#22C55E]'
                            : showIncorrectHighlight
                            ? 'border-[#EF4444] bg-[#EF4444]/5 text-[#EF4444]'
                            : isSelected
                            ? 'border-[#6C63FF] bg-[#6C63FF]/5 text-[#6C63FF]'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Fill in the blank */}
              {question.question_type === 'fill_blank' && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={fillBlankValue}
                    onChange={(e) => setFillBlankValue(e.target.value)}
                    disabled={showFeedback}
                    placeholder="Type your answer..."
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:border-[#6C63FF] focus:outline-none transition-colors disabled:bg-gray-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && hasAnswer && !showFeedback) {
                        handleSubmit();
                      }
                    }}
                  />
                </div>
              )}

              {/* Hints */}
              {!showFeedback && hints.length > 0 && (
                <div className="mt-4 space-y-2">
                  {hints.slice(0, hintsRevealed).map((hint, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                    >
                      <p className="text-sm text-yellow-800">{hint}</p>
                    </motion.div>
                  ))}
                  {hintsRemaining > 0 && (
                    <button
                      onClick={handleRevealHint}
                      className="inline-flex items-center gap-1.5 text-sm text-yellow-600 hover:text-yellow-700 font-medium transition-colors"
                    >
                      <Lightbulb className="w-4 h-4" />
                      Show hint ({hintsRemaining} left)
                    </button>
                  )}
                </div>
              )}

              {/* Progressive hint button (API-powered) */}
              {!showFeedback && (
                <div className="mt-4">
                  {progressiveHints.map((hint, i) => (
                    <motion.div
                      key={`prog-hint-${i}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-2"
                    >
                      <p className="text-sm text-purple-800">{hint}</p>
                    </motion.div>
                  ))}
                  <button
                    onClick={handleFetchProgressiveHint}
                    disabled={isLoadingHint}
                    className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors disabled:opacity-50"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {isLoadingHint
                      ? 'Loading hint...'
                      : `Get hint (${progressiveHints.length} used)`}
                  </button>
                </div>
              )}

              {/* Feedback display */}
              <AnimatePresence>
                {showFeedback && feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-6"
                  >
                    <div
                      className={`flex items-start gap-3 p-4 rounded-xl ${
                        feedback.is_correct
                          ? 'bg-[#22C55E]/10'
                          : rephraseCount > 0
                          ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35]/30'
                          : 'bg-[#EF4444]/10'
                      }`}
                    >
                      {feedback.is_correct ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.3, 1] }}
                          transition={{ duration: 0.4 }}
                        >
                          <CheckCircle className="w-6 h-6 text-[#22C55E] flex-shrink-0 mt-0.5" />
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ x: 0 }}
                          animate={{ x: [-4, 4, -4, 4, 0] }}
                          transition={{ duration: 0.4 }}
                        >
                          <XCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                            rephraseCount > 0 ? 'text-[#FF6B35]' : 'text-[#EF4444]'
                          }`} />
                        </motion.div>
                      )}
                      <div className="flex-1">
                        <p
                          className={`font-semibold ${
                            feedback.is_correct
                              ? 'text-[#22C55E]'
                              : rephraseCount > 0
                              ? 'text-[#FF6B35]'
                              : 'text-[#EF4444]'
                          }`}
                        >
                          {feedback.is_correct ? 'Correct!' : 'Not quite'}
                        </p>

                        {/* Show rephrase explanation instead of just correct answer on wrong */}
                        {!feedback.is_correct && rephraseExplanation && (
                          <div className="mt-2 p-3 bg-white/60 rounded-lg">
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {rephraseExplanation}
                            </p>
                          </div>
                        )}

                        {!feedback.is_correct && !rephraseExplanation && feedback.explanation && (
                          <p className="text-gray-700 text-sm mt-1">
                            {feedback.explanation}
                          </p>
                        )}

                        {!feedback.is_correct && feedback.correct_answer && (
                          <p className="text-sm mt-2 text-gray-600">
                            The correct answer is{' '}
                            <span className="font-semibold text-gray-900">
                              {feedback.correct_answer}
                            </span>
                          </p>
                        )}

                        {/* Rephrase button on wrong answer */}
                        {!feedback.is_correct && (
                          <button
                            onClick={handleRephrase}
                            disabled={isLoadingRephrase}
                            className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#6C63FF] hover:text-[#5B54E6] font-medium transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${isLoadingRephrase ? 'animate-spin' : ''}`} />
                            {isLoadingRephrase
                              ? 'Rephrasing...'
                              : rephraseCount > 0
                              ? 'Explain differently again'
                              : 'Explain differently'}
                          </button>
                        )}

                        {/* Visual escalation indicator */}
                        {rephraseCount > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            {Array.from({ length: rephraseCount }).map((_, i) => (
                              <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-[#FF6B35]"
                              />
                            ))}
                            <span className="text-xs text-gray-400 ml-1">
                              {rephraseCount} rephrase{rephraseCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Action button */}
      <div className="pt-2">
        {showFeedback ? (
          <Button
            onClick={handleNext}
            className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] text-white py-3 rounded-xl text-lg font-semibold transition-colors"
          >
            {isLastQuestion ? 'See Results' : 'Next Question'}
            <ArrowRight className="w-5 h-5 ml-2 inline-block" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!hasAnswer || isSubmitting}
            className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-lg font-semibold transition-colors"
          >
            {isSubmitting ? 'Checking...' : 'Submit Answer'}
          </Button>
        )}
      </div>
    </div>
  );
}
