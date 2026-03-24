'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2 } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PostExamProps {
  projectId: string;
  onComplete: () => void;
}

interface FeelingOption {
  emoji: string;
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ */
/*  Feeling options                                                    */
/* ------------------------------------------------------------------ */

const feelings: FeelingOption[] = [
  { emoji: '\uD83C\uDF89', label: 'Great', value: 'great' },
  { emoji: '\uD83D\uDC4D', label: 'Okay', value: 'okay' },
  { emoji: '\uD83D\uDE24', label: 'Tough', value: 'tough' },
  { emoji: '\uD83E\uDD14', label: 'Not sure', value: 'not_sure' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PostExam({ projectId, onComplete }: PostExamProps) {
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [grade, setGrade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedFeeling) return;

    setSubmitting(true);

    try {
      await fetch(`/api/projects/${projectId}/post-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeling: selectedFeeling,
          grade: grade.trim() || null,
        }),
      });

      setSubmitted(true);

      // Brief pause to show success, then trigger wrapped view
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (error) {
      console.error('Failed to submit post-exam feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="rounded-2xl overflow-hidden shadow-lg shadow-gray-200/60 bg-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Soft gradient header */}
      <div className="bg-gradient-to-br from-[#6C63FF]/10 via-[#6C63FF]/5 to-transparent px-6 py-6">
        <h2 className="text-xl font-bold text-gray-900">How did it go?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Take a moment to reflect on your exam.
        </p>
      </div>

      <div className="px-6 py-5 space-y-6">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              className="flex flex-col items-center py-8 gap-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CheckCircle2 className="w-12 h-12 text-[#22C55E]" />
              <p className="text-gray-700 font-medium">Thanks for sharing!</p>
              <p className="text-sm text-gray-400">
                Loading your Study Wrapped...
              </p>
            </motion.div>
          ) : (
            <motion.div key="form" className="space-y-6">
              {/* Feeling picker */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-3">
                  How do you feel about the exam?
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {feelings.map((f) => {
                    const active = selectedFeeling === f.value;
                    return (
                      <motion.button
                        key={f.value}
                        type="button"
                        onClick={() => setSelectedFeeling(f.value)}
                        whileTap={{ scale: 0.92 }}
                        className={`
                          flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl
                          border-2 transition-colors duration-200 cursor-pointer
                          ${
                            active
                              ? 'border-[#6C63FF] bg-[#6C63FF]/[0.06]'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                          }
                        `}
                      >
                        <motion.span
                          className="text-2xl"
                          animate={active ? { scale: [1, 1.25, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          {f.emoji}
                        </motion.span>
                        <span
                          className={`text-xs font-medium ${
                            active ? 'text-[#6C63FF]' : 'text-gray-500'
                          }`}
                        >
                          {f.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Grade input */}
              <div>
                <label
                  htmlFor="grade-input"
                  className="block text-sm font-medium text-gray-600 mb-2"
                >
                  Grade (optional)
                </label>
                <input
                  id="grade-input"
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g. 85%, A-, Pass"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200
                             text-sm text-gray-700 placeholder-gray-400
                             focus:border-[#6C63FF] focus:outline-none
                             transition-colors duration-200"
                />
              </div>

              {/* Submit */}
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFeeling || submitting}
                whileTap={selectedFeeling ? { scale: 0.97 } : undefined}
                className={`
                  w-full flex items-center justify-center gap-2
                  px-6 py-3.5 rounded-xl font-semibold text-sm
                  transition-all duration-200 cursor-pointer
                  ${
                    selectedFeeling && !submitting
                      ? 'bg-[#6C63FF] text-white hover:bg-[#5a52e0] shadow-md shadow-[#6C63FF]/20'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit &amp; See Your Wrapped
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
