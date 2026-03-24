'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionCard from '@/components/onboarding/QuestionCard';
import ProfileSummary from '@/components/onboarding/ProfileSummary';
import { useProfileStore } from '@/stores/profileStore';
import type { OnboardingQuestion, UserProfile } from '@/types';

/* ------------------------------------------------------------------ */
/*  Questions                                                         */
/* ------------------------------------------------------------------ */

const questions: OnboardingQuestion[] = [
  {
    id: 1,
    question: 'How do you prefer to take in information?',
    options: [
      'Reading text',
      'Listening to audio',
      'Watching visuals & diagrams',
      'A mix of everything',
    ],
  },
  {
    id: 2,
    question: 'When you sit down to study, how long before you usually lose focus?',
    options: [
      'Under 10 minutes',
      '10 to 20 minutes',
      '20 to 40 minutes',
      'Over 40 minutes',
    ],
  },
  {
    id: 3,
    question: 'How do you feel about quizzes and challenges while studying?',
    options: [
      'Love them \u2014 they keep me engaged',
      "They're fine in small doses",
      'I prefer to just review at my own pace',
    ],
  },
  {
    id: 4,
    question: 'Is English your first language?',
    options: [
      'Yes',
      "No, but I'm comfortable with academic English",
      'No, and I sometimes struggle with complex terminology',
    ],
  },
  {
    id: 5,
    question: 'Do you identify with any of these? (Select all that apply)',
    options: [
      'ADHD or attention difficulties',
      'Dyslexia or reading difficulties',
      'Autism',
      'None of these',
      'Prefer not to say',
    ],
    multiSelect: true,
  },
  {
    id: 6,
    question: 'When do you usually study?',
    options: ['Morning', 'Afternoon', 'Evening', 'Late night', 'It varies'],
  },
  {
    id: 7,
    question: 'What motivates you most?',
    options: [
      'Seeing my progress in stats',
      'Daily streaks and goals',
      'Competing with friends',
      'Just passing the exam',
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Answer-to-profile mapping helpers                                 */
/* ------------------------------------------------------------------ */

function answersToProfile(
  answers: Record<number, string | string[]>,
): UserProfile {
  const a = (id: number) => answers[id] as string;

  const modalityMap: Record<string, UserProfile['learning_modality']> = {
    'Reading text': 'reading',
    'Listening to audio': 'audio',
    'Watching visuals & diagrams': 'visual',
    'A mix of everything': 'mixed',
  };

  const attentionMap: Record<string, number> = {
    'Under 10 minutes': 8,
    '10 to 20 minutes': 15,
    '20 to 40 minutes': 30,
    'Over 40 minutes': 50,
  };

  const engagementMap: Record<string, UserProfile['engagement_style']> = {
    'Love them \u2014 they keep me engaged': 'gamified',
    "They're fine in small doses": 'moderate',
    'I prefer to just review at my own pace': 'self_paced',
  };

  const languageMap: Record<string, UserProfile['language']['english_comfort']> = {
    Yes: 'native',
    "No, but I'm comfortable with academic English": 'comfortable',
    'No, and I sometimes struggle with complex terminology': 'struggling',
  };

  const studyTimeMap: Record<string, UserProfile['study_time_preference']> = {
    Morning: 'morning',
    Afternoon: 'afternoon',
    Evening: 'evening',
    'Late night': 'night',
    'It varies': 'varies',
  };

  const motivationMap: Record<string, UserProfile['motivation_type']> = {
    'Seeing my progress in stats': 'progress_stats',
    'Daily streaks and goals': 'streaks',
    'Competing with friends': 'social',
    'Just passing the exam': 'outcome_focused',
  };

  const ndSelections = (answers[5] as string[]) ?? [];

  return {
    learning_modality: modalityMap[a(1)] ?? 'mixed',
    attention_span_minutes: attentionMap[a(2)] ?? 20,
    engagement_style: engagementMap[a(3)] ?? 'moderate',
    language: {
      first_language: languageMap[a(4)] === 'native' ? 'English' : '',
      english_comfort: languageMap[a(4)] ?? 'comfortable',
    },
    neurodivergent: {
      adhd: ndSelections.includes('ADHD or attention difficulties'),
      dyslexia: ndSelections.includes('Dyslexia or reading difficulties'),
      autism: ndSelections.includes('Autism'),
      other: null,
    },
    study_time_preference: studyTimeMap[a(6)] ?? 'varies',
    motivation_type: motivationMap[a(7)] ?? 'outcome_focused',
    custom_notes: '',
  };
}

/* ------------------------------------------------------------------ */
/*  Background gradient palette per step                               */
/* ------------------------------------------------------------------ */

const stepGradients = [
  'linear-gradient(135deg, #F8F9FA 0%, #EDE9FE 100%)', // Q1 - soft lavender
  'linear-gradient(135deg, #F8F9FA 0%, #DBEAFE 100%)', // Q2 - soft blue
  'linear-gradient(135deg, #F8F9FA 0%, #FEF3C7 100%)', // Q3 - soft amber
  'linear-gradient(135deg, #F8F9FA 0%, #FCE7F3 100%)', // Q4 - soft pink
  'linear-gradient(135deg, #F8F9FA 0%, #D1FAE5 100%)', // Q5 - soft green
  'linear-gradient(135deg, #F8F9FA 0%, #E0E7FF 100%)', // Q6 - soft indigo
  'linear-gradient(135deg, #F8F9FA 0%, #FDE68A40 100%)', // Q7 - soft yellow
  'linear-gradient(135deg, #EDE9FE 0%, #DBEAFE 100%)', // Summary
];

/* ------------------------------------------------------------------ */
/*  Slide animation variants                                          */
/* ------------------------------------------------------------------ */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const router = useRouter();
  const { submitOnboarding, profile, loading } = useProfileStore();

  const [step, setStep] = useState(0); // 0-6 = questions, 7 = summary
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

  const totalQuestions = questions.length;
  const showingSummary = step === totalQuestions;
  const currentQ = questions[step] ?? null;

  /* ---- selection handler ---- */
  const handleSelect = useCallback(
    (value: string) => {
      if (!currentQ) return;

      const qId = currentQ.id;

      if (currentQ.multiSelect) {
        setAnswers((prev) => {
          const current = (prev[qId] as string[]) ?? [];
          // "None of these" / "Prefer not to say" are exclusive
          const exclusives = ['None of these', 'Prefer not to say'];
          if (exclusives.includes(value)) {
            return { ...prev, [qId]: [value] };
          }
          // Deselect exclusives when picking a real option
          const filtered = current.filter((v) => !exclusives.includes(v));
          if (filtered.includes(value)) {
            return { ...prev, [qId]: filtered.filter((v) => v !== value) };
          }
          return { ...prev, [qId]: [...filtered, value] };
        });
      } else {
        setAnswers((prev) => ({ ...prev, [qId]: value }));
        // Auto-advance after a short delay for single-select
        setTimeout(() => {
          setDirection(1);
          setStep((s) => Math.min(s + 1, totalQuestions));
        }, 350);
      }
    },
    [currentQ, totalQuestions],
  );

  /* ---- navigation ---- */
  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, totalQuestions));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  /* ---- confirm profile ---- */
  const handleConfirm = async () => {
    const payload = questions.map((q) => ({
      question_id: q.id,
      answer: Array.isArray(answers[q.id])
        ? (answers[q.id] as string[]).join(', ')
        : (answers[q.id] as string) ?? '',
    }));

    await submitOnboarding(payload);
    router.push('/dashboard');
  };

  /* ---- can proceed? ---- */
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const canProceed = currentQ?.multiSelect
    ? Array.isArray(currentAnswer) && currentAnswer.length > 0
    : !!currentAnswer;

  /* ---- derived profile for summary ---- */
  const derivedProfile = showingSummary ? answersToProfile(answers) : null;

  /* ---- background gradient based on current step ---- */
  const currentGradient = useMemo(
    () => stepGradients[Math.min(step, stepGradients.length - 1)],
    [step],
  );

  return (
    <motion.div
      className="min-h-screen flex flex-col"
      animate={{ background: currentGradient }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Progress bar */}
      <div className="w-full px-6 pt-6 pb-2 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">
            {showingSummary
              ? 'Your profile'
              : `Step ${step + 1} of ${totalQuestions}`}
          </span>
          {step > 0 && !showingSummary && (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-[#6C63FF] font-medium hover:underline cursor-pointer"
            >
              Back
            </button>
          )}
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#6C63FF]"
            initial={false}
            animate={{
              width: `${((showingSummary ? totalQuestions : step) / totalQuestions) * 100}%`,
            }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <AnimatePresence mode="wait" custom={direction}>
          {showingSummary && derivedProfile ? (
            <motion.div
              key="summary"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full"
            >
              <ProfileSummary
                profile={profile ?? derivedProfile}
                onConfirm={handleConfirm}
              />
            </motion.div>
          ) : currentQ ? (
            <motion.div
              key={currentQ.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="w-full"
            >
              <QuestionCard
                question={currentQ.question}
                options={currentQ.options}
                selected={answers[currentQ.id] ?? (currentQ.multiSelect ? [] : '')}
                onSelect={handleSelect}
                multiSelect={currentQ.multiSelect}
              />

              {/* Next button for multi-select questions */}
              {currentQ.multiSelect && (
                <div className="flex justify-center mt-8">
                  <motion.button
                    type="button"
                    onClick={goNext}
                    disabled={!canProceed}
                    className={`
                      px-8 py-3 rounded-xl font-semibold text-white text-sm
                      transition-all duration-200 cursor-pointer
                      ${
                        canProceed
                          ? 'bg-[#6C63FF] hover:bg-[#5a52e0] shadow-md shadow-[#6C63FF]/20'
                          : 'bg-gray-300 cursor-not-allowed'
                      }
                    `}
                    whileTap={canProceed ? { scale: 0.97 } : undefined}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    Continue
                  </motion.button>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-gray-500">
                Building your profile...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
