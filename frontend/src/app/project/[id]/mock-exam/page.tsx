'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Send,
} from 'lucide-react';
import AuthGuard from '@/components/auth/AuthGuard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import Modal from '@/components/ui/Modal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ExamQuestion {
  id: string;
  section: string;
  topic: string;
  question_text: string;
  question_type: 'mcq' | 'short_answer' | 'essay';
  options?: string[];
  points: number;
}

interface ExamData {
  id: string;
  title: string;
  duration_minutes: number;
  sections: { name: string; question_ids: string[] }[];
  questions: ExamQuestion[];
}

interface SectionBreakdown {
  name: string;
  score: number;
  total: number;
  percentage: number;
}

interface TopicBreakdown {
  topic: string;
  score: number;
  total: number;
  percentage: number;
}

interface ExamResults {
  overall_score: number;
  overall_total: number;
  overall_percentage: number;
  section_breakdown: SectionBreakdown[];
  topic_breakdown: TopicBreakdown[];
  weak_areas: string[];
  recommendations: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Timer hook                                                         */
/* ------------------------------------------------------------------ */

function useCountdown(totalSeconds: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
      return;
    }
    const timer = setInterval(() => setRemaining((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining, onExpire]);

  return remaining;
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

function SectionSidebar({
  sections,
  questions,
  answers,
  flagged,
  currentIdx,
  onSelect,
  open,
  onToggle,
}: {
  sections: ExamData['sections'];
  questions: ExamQuestion[];
  answers: Record<string, string>;
  flagged: Set<string>;
  currentIdx: number;
  onSelect: (idx: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-40 lg:hidden p-2 rounded-xl bg-white shadow-md"
        aria-label="Toggle sections"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-30 overflow-y-auto p-4 lg:static lg:shadow-none lg:border-r lg:border-gray-100"
          >
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 mt-2">
              Sections
            </h3>
            {sections.map((section) => (
              <div key={section.name} className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">{section.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {section.question_ids.map((qid) => {
                    const globalIdx = questions.findIndex((q) => q.id === qid);
                    const answered = !!answers[qid];
                    const isFlagged = flagged.has(qid);
                    const isCurrent = globalIdx === currentIdx;

                    let bg = 'bg-gray-100 text-gray-500';
                    if (isCurrent) bg = 'bg-[#6C63FF] text-white';
                    else if (isFlagged) bg = 'bg-orange-100 text-orange-600';
                    else if (answered) bg = 'bg-[#22C55E]/20 text-[#22C55E]';

                    return (
                      <button
                        key={qid}
                        onClick={() => onSelect(globalIdx)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${bg}`}
                      >
                        {globalIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Question Display                                                   */
/* ------------------------------------------------------------------ */

function QuestionView({
  question,
  answer,
  flagged,
  onAnswer,
  onToggleFlag,
}: {
  question: ExamQuestion;
  answer: string;
  flagged: boolean;
  onAnswer: (value: string) => void;
  onToggleFlag: () => void;
}) {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-start justify-between mb-6">
        <p className="text-lg sm:text-xl font-semibold text-gray-800 leading-relaxed pr-4">
          {question.question_text}
        </p>
        <button
          onClick={onToggleFlag}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            flagged
              ? 'bg-orange-100 text-orange-500'
              : 'bg-gray-100 text-gray-400 hover:text-orange-400'
          }`}
          aria-label={flagged ? 'Unflag question' : 'Flag for review'}
        >
          <Flag className="w-5 h-5" fill={flagged ? 'currentColor' : 'none'} />
        </button>
      </div>

      <p className="text-xs font-medium text-gray-400 mb-4">
        {question.points} point{question.points !== 1 ? 's' : ''} &middot;{' '}
        {question.section}
      </p>

      {/* MCQ */}
      {question.question_type === 'mcq' && question.options && (
        <div className="space-y-3">
          {question.options.map((opt, idx) => {
            const selected = answer === opt;
            return (
              <button
                key={idx}
                onClick={() => onAnswer(opt)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                  selected
                    ? 'border-[#6C63FF] bg-[#6C63FF]/5 text-[#6C63FF]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#6C63FF]/40'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Short answer */}
      {question.question_type === 'short_answer' && (
        <textarea
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          rows={3}
          placeholder="Type your answer..."
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 outline-none transition-all resize-none text-gray-800"
        />
      )}

      {/* Essay */}
      {question.question_type === 'essay' && (
        <textarea
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          rows={8}
          placeholder="Write your essay response..."
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20 outline-none transition-all resize-y text-gray-800"
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Results View                                                       */
/* ------------------------------------------------------------------ */

function ResultsView({ results }: { results: ExamResults }) {
  const getColor = (pct: number) =>
    pct >= 80 ? '#22C55E' : pct >= 50 ? '#EAB308' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 py-10 space-y-8"
    >
      {/* Overall Score */}
      <Card className="text-center py-10">
        <BarChart3 className="w-10 h-10 mx-auto text-[#6C63FF] mb-3" />
        <h2 className="text-3xl font-bold text-gray-900 mb-1">
          {results.overall_score} / {results.overall_total}
        </h2>
        <p className="text-lg font-semibold" style={{ color: getColor(results.overall_percentage) }}>
          {results.overall_percentage}%
        </p>
        <ProgressBar
          value={results.overall_percentage}
          color={getColor(results.overall_percentage)}
          height={10}
          className="max-w-xs mx-auto mt-4"
        />
      </Card>

      {/* Section Breakdown */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Section Breakdown</h3>
        <div className="space-y-4">
          {results.section_breakdown.map((sec) => (
            <div key={sec.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{sec.name}</span>
                <span className="text-sm font-bold" style={{ color: getColor(sec.percentage) }}>
                  {sec.score}/{sec.total} ({sec.percentage}%)
                </span>
              </div>
              <ProgressBar value={sec.percentage} color={getColor(sec.percentage)} height={8} />
            </div>
          ))}
        </div>
      </Card>

      {/* Topic Breakdown */}
      <Card>
        <h3 className="text-lg font-bold text-gray-800 mb-4">Topic Breakdown</h3>
        <div className="space-y-4">
          {results.topic_breakdown.map((topic) => (
            <div key={topic.topic}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
                <span className="text-sm font-bold" style={{ color: getColor(topic.percentage) }}>
                  {topic.percentage}%
                </span>
              </div>
              <ProgressBar value={topic.percentage} color={getColor(topic.percentage)} height={8} />
            </div>
          ))}
        </div>
      </Card>

      {/* Weak Areas */}
      {results.weak_areas.length > 0 && (
        <Card className="border-l-4 border-l-orange-400">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-bold text-gray-800">Areas to Improve</h3>
          </div>
          <ul className="space-y-2">
            {results.weak_areas.map((area) => (
              <li key={area} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                {area}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recommendations */}
      {results.recommendations.length > 0 && (
        <Card className="border-l-4 border-l-[#6C63FF]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-[#6C63FF]" />
            <h3 className="text-lg font-bold text-gray-800">Recommendations</h3>
          </div>
          <ul className="space-y-2">
            {results.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Exam Page                                                     */
/* ------------------------------------------------------------------ */

function MockExamContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  /* State */
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [results, setResults] = useState<ExamResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Fetch exam */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ExamData>(
          `/api/projects/${projectId}/mock-exam/generate`,
          { method: 'POST' },
        );
        if (!cancelled) {
          setExam(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /* Timer expiry handler */
  const handleTimeUp = useCallback(() => {
    if (!results) handleSubmit();
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = useCountdown(
    exam ? exam.duration_minutes * 60 : 3600,
    handleTimeUp,
  );

  /* Submit */
  const handleSubmit = async () => {
    if (!exam || submitting) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const res = await apiFetch<ExamResults>(
        `/api/projects/${projectId}/mock-exam/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ exam_id: exam.id, answers }),
        },
      );
      setResults(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* Derived */
  const questions = exam?.questions ?? [];
  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).filter((k) => answers[k]?.trim()).length;
  const flaggedCount = flagged.size;
  const timerWarning = remaining < 300; // less than 5 minutes

  /* ------- Loading / Error ------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Generating your mock exam...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FA]">
        <Card className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-800 font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Card>
      </div>
    );
  }

  /* ------- Results view ------- */
  if (results) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <ResultsView results={results} />
        <div className="text-center pb-10">
          <Button onClick={() => router.push(`/project/${projectId}`)}>
            Back to Project
          </Button>
        </div>
      </div>
    );
  }

  /* ------- Exam in progress ------- */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Section Sidebar */}
      {exam && (
        <SectionSidebar
          sections={exam.sections}
          questions={questions}
          answers={answers}
          flagged={flagged}
          currentIdx={currentIdx}
          onSelect={(idx) => {
            setCurrentIdx(idx);
            setSidebarOpen(false);
          }}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-20 px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold ${
                timerWarning
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(remaining)}
            </div>

            {/* Progress info */}
            <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-gray-500">
              <span>{answeredCount}/{questions.length} answered</span>
              {flaggedCount > 0 && (
                <span className="text-orange-500">
                  <Flag className="w-3.5 h-3.5 inline mr-0.5" />
                  {flaggedCount} flagged
                </span>
              )}
            </div>

            {/* Submit */}
            <Button
              size="sm"
              onClick={() => setShowConfirm(true)}
              loading={submitting}
              className="bg-[#FF6B35] hover:bg-[#e55e2e] text-white"
            >
              <Send className="w-4 h-4 mr-1" />
              Submit
            </Button>
          </div>

          {/* Progress bar */}
          <div className="max-w-3xl mx-auto mt-2">
            <ProgressBar
              value={(answeredCount / Math.max(questions.length, 1)) * 100}
              height={4}
              color="#6C63FF"
            />
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 px-4 sm:px-6 py-8">
          <AnimatePresence mode="wait">
            {currentQ && (
              <QuestionView
                key={currentQ.id}
                question={currentQ}
                answer={answers[currentQ.id] ?? ''}
                flagged={flagged.has(currentQ.id)}
                onAnswer={(val) =>
                  setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))
                }
                onToggleFlag={() =>
                  setFlagged((prev) => {
                    const next = new Set(prev);
                    next.has(currentQ.id) ? next.delete(currentQ.id) : next.add(currentQ.id);
                    return next;
                  })
                }
              />
            )}
          </AnimatePresence>
        </div>

        {/* Bottom navigation */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 sm:px-6 py-3 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>

            <span className="text-sm font-semibold text-gray-500">
              {currentIdx + 1} / {questions.length}
            </span>

            <Button
              variant="ghost"
              size="sm"
              disabled={currentIdx >= questions.length - 1}
              onClick={() => setCurrentIdx((p) => Math.min(questions.length - 1, p + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Submit Exam?"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            You have answered <strong>{answeredCount}</strong> of{' '}
            <strong>{questions.length}</strong> questions.
            {flaggedCount > 0 && (
              <>
                {' '}You have <strong className="text-orange-500">{flaggedCount}</strong> flagged
                for review.
              </>
            )}
          </p>
          {answeredCount < questions.length && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-orange-50 text-orange-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Some questions are unanswered. Unanswered questions will be scored as incorrect.
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              Continue Exam
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              className="bg-[#FF6B35] hover:bg-[#e55e2e] text-white"
            >
              Submit Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function MockExamPage() {
  return (
    <AuthGuard>
      <MockExamContent />
    </AuthGuard>
  );
}
