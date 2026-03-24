'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { ContentBlock } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface ContentDisplayProps {
  contentBlocks: ContentBlock[];
  onComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Summary renderer                                                   */
/* ------------------------------------------------------------------ */
function SummaryContent({
  block,
  index,
}: {
  block: ContentBlock;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="space-y-6"
    >
      {block.sections?.map((section, sIdx) => (
        <div key={sIdx} className="space-y-3">
          {section.heading && (
            <h3 className="text-xl font-semibold text-gray-900">
              {section.heading}
            </h3>
          )}

          {section.content && (
            <p className="text-gray-700 leading-relaxed">{section.content}</p>
          )}

          {/* Key terms */}
          {section.key_terms && section.key_terms.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {section.key_terms.map((term, tIdx) => (
                <span
                  key={tIdx}
                  className="group relative inline-block"
                >
                  <span className="font-bold text-[#6C63FF] border-b border-dashed border-[#6C63FF]/40 cursor-help">
                    {term.term}
                  </span>
                  {term.definition && (
                    <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-20 max-w-xs text-center">
                      {term.definition}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Examples */}
          {section.examples && section.examples.length > 0 && (
            <div className="space-y-2">
              {section.examples.map((example, eIdx) => (
                <div
                  key={eIdx}
                  className="bg-[#6C63FF]/5 border-l-4 border-[#6C63FF]/30 rounded-r-xl px-4 py-3"
                >
                  <p className="text-sm text-gray-700">{example}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Micro-lesson renderer                                              */
/* ------------------------------------------------------------------ */
function MicroLessonContent({
  block,
  onDone,
}: {
  block: ContentBlock;
  onDone: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = block.steps ?? [];
  const total = steps.length;
  const isLast = currentStep >= total - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onDone();
    } else {
      setCurrentStep((p) => p + 1);
    }
  }, [isLast, onDone]);

  const goPrev = useCallback(() => {
    setCurrentStep((p) => Math.max(0, p - 1));
  }, []);

  if (total === 0) return null;

  const step = steps[currentStep];

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i === currentStep
                ? 'bg-[#6C63FF] scale-125'
                : i < currentStep
                ? 'bg-[#6C63FF]/40'
                : 'bg-gray-300'
            }`}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 md:p-8">
            {step.concept_name && (
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {step.concept_name}
              </h3>
            )}

            {step.hook && (
              <p className="italic text-gray-500 mb-4">{step.hook}</p>
            )}

            {step.content && (
              <p className="text-gray-700 leading-relaxed mb-4">
                {step.content}
              </p>
            )}

            {step.key_takeaway && (
              <div className="bg-[#FF6B35]/5 border border-[#FF6B35]/20 rounded-xl px-4 py-3 mt-4">
                <p className="text-sm font-medium text-[#FF6B35] mb-1">
                  Key Takeaway
                </p>
                <p className="text-gray-800 text-sm">{step.key_takeaway}</p>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="text-sm font-medium text-gray-400 hover:text-gray-600 disabled:opacity-0 transition-colors"
        >
          &larr; Previous
        </button>

        {isLast ? (
          <Button
            onClick={onDone}
            className="bg-[#6C63FF] hover:bg-[#5B54E6] text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
          >
            Done
            <ChevronRight className="w-4 h-4 ml-1 inline-block" />
          </Button>
        ) : (
          <button
            onClick={goNext}
            className="text-sm font-medium text-[#6C63FF] hover:text-[#5B54E6] transition-colors flex items-center gap-1"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function ContentDisplay({
  contentBlocks,
  onComplete,
}: ContentDisplayProps) {
  const [microLessonsDone, setMicroLessonsDone] = useState<Set<number>>(
    new Set()
  );

  const allMicroLessonsDone = contentBlocks.every((block, i) => {
    if (block.content_type === 'micro_lesson') return microLessonsDone.has(i);
    return true;
  });

  const handleMicroDone = useCallback((index: number) => {
    setMicroLessonsDone((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  return (
    <div className="space-y-8">
      {contentBlocks.map((block, idx) => (
        <div key={idx}>
          {block.content_type === 'summary' && (
            <SummaryContent block={block} index={idx} />
          )}
          {block.content_type === 'micro_lesson' && (
            <MicroLessonContent
              block={block}
              onDone={() => handleMicroDone(idx)}
            />
          )}
        </div>
      ))}

      {/* Continue to Quiz button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="pt-4"
      >
        <Button
          onClick={onComplete}
          disabled={!allMicroLessonsDone}
          className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-lg font-semibold transition-colors"
        >
          Ready for Questions
          <ArrowRight className="w-5 h-5 ml-2 inline-block" />
        </Button>
      </motion.div>
    </div>
  );
}
