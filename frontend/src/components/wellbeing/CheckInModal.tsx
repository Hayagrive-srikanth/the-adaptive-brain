'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mood: string, energy: string) => void;
}

const MOODS = [
  { value: 'great', emoji: '\u{1F60A}', label: 'Great' },
  { value: 'okay', emoji: '\u{1F610}', label: 'Okay' },
  { value: 'stressed', emoji: '\u{1F630}', label: 'Stressed' },
  { value: 'burnt_out', emoji: '\u{1F525}', label: 'Burnt out' },
];

const ENERGY_LEVELS = [
  { value: 'high', emoji: '\u{26A1}', label: 'High' },
  { value: 'medium', emoji: '\u{1F50B}', label: 'Medium' },
  { value: 'low', emoji: '\u{1FAAB}', label: 'Low' },
];

export default function CheckInModal({ isOpen, onClose, onSubmit }: CheckInModalProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedMood && selectedEnergy) {
      onSubmit(selectedMood, selectedEnergy);
      setSelectedMood(null);
      setSelectedEnergy(null);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="text-center">
        {/* Purple gradient header */}
        <div className="bg-gradient-to-r from-[#6C63FF] to-[#9B59B6] -mx-6 -mt-6 px-6 pt-8 pb-6 rounded-t-2xl mb-6">
          <h2 className="text-xl font-bold text-white mb-1">
            How are you feeling?
          </h2>
          <p className="text-white/70 text-sm">
            A quick check before we start
          </p>
        </div>

        {/* Mood selection */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Current mood
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MOODS.map((mood) => (
              <motion.button
                key={mood.value}
                onClick={() => setSelectedMood(mood.value)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  selectedMood === mood.value
                    ? 'border-[#6C63FF] bg-[#6C63FF]/5 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span
                  className={`font-medium ${
                    selectedMood === mood.value ? 'text-[#6C63FF]' : 'text-gray-700'
                  }`}
                >
                  {mood.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Energy level */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Energy level
          </p>
          <div className="grid grid-cols-3 gap-3">
            {ENERGY_LEVELS.map((energy) => (
              <motion.button
                key={energy.value}
                onClick={() => setSelectedEnergy(energy.value)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  selectedEnergy === energy.value
                    ? 'border-[#6C63FF] bg-[#6C63FF]/5 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <span className="text-2xl">{energy.emoji}</span>
                <span
                  className={`text-sm font-medium ${
                    selectedEnergy === energy.value ? 'text-[#6C63FF]' : 'text-gray-700'
                  }`}
                >
                  {energy.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedMood || !selectedEnergy}
          className="w-full bg-[#6C63FF] hover:bg-[#5B54E6] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-lg font-semibold transition-colors"
        >
          Let&apos;s Study
        </Button>

        <button
          onClick={onClose}
          className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip check-in
        </button>
      </div>
    </Modal>
  );
}
