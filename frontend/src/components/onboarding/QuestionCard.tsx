'use client';

import { motion } from 'framer-motion';

interface QuestionCardProps {
  question: string;
  options: string[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multiSelect?: boolean;
}

export default function QuestionCard({
  question,
  options,
  selected,
  onSelect,
  multiSelect = false,
}: QuestionCardProps) {
  const isSelected = (option: string) => {
    if (Array.isArray(selected)) {
      return selected.includes(option);
    }
    return selected === option;
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <motion.h2
        className="text-2xl font-semibold text-gray-800 mb-2 text-center leading-snug"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {question}
      </motion.h2>

      {multiSelect && (
        <p className="text-sm text-gray-500 text-center mb-6">
          Select all that apply
        </p>
      )}

      {!multiSelect && <div className="mb-6" />}

      <div className="flex flex-col gap-3">
        {options.map((option, index) => {
          const active = isSelected(option);

          return (
            <motion.button
              key={option}
              type="button"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(option)}
              animate={
                active
                  ? { scale: [1, 1.04, 0.98, 1] }
                  : { scale: 1 }
              }
              className={`
                relative w-full min-h-[56px] px-5 py-4 rounded-xl text-left text-[15px] font-medium
                transition-colors duration-200 cursor-pointer
                border-2 shadow-sm
                ${
                  active
                    ? 'border-[#6C63FF] bg-[#6C63FF]/[0.08] text-[#6C63FF]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {active && (
                <motion.span
                  layoutId="check"
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-[#6C63FF] text-white text-xs"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  &#10003;
                </motion.span>
              )}
              {option}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
