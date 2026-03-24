'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Check, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

interface Flashcard {
  term: string;
  definition: string;
}

interface FlashcardDeckProps {
  cards: Flashcard[];
  onComplete: (results: { known: number; unknown: number; total: number }) => void;
}

export default function FlashcardDeck({ cards, onComplete }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [unknownCount, setUnknownCount] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  const totalCards = cards.length;
  const currentCard = cards[currentIndex];
  const completedCount = knownCount + unknownCount;
  const isFinished = completedCount >= totalCards;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const advance = useCallback(
    (knew: boolean) => {
      if (knew) {
        setKnownCount((p) => p + 1);
        setDirection('right');
      } else {
        setUnknownCount((p) => p + 1);
        setDirection('left');
      }

      setTimeout(() => {
        if (currentIndex + 1 >= totalCards) {
          const finalKnown = knew ? knownCount + 1 : knownCount;
          const finalUnknown = knew ? unknownCount : unknownCount + 1;
          onComplete({ known: finalKnown, unknown: finalUnknown, total: totalCards });
        } else {
          setCurrentIndex((p) => p + 1);
          setIsFlipped(false);
          setDirection(null);
        }
      }, 300);
    },
    [currentIndex, totalCards, knownCount, unknownCount, onComplete]
  );

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 100;
      if (info.offset.x > threshold) {
        advance(true);
      } else if (info.offset.x < -threshold) {
        advance(false);
      }
    },
    [advance]
  );

  if (isFinished) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Deck Complete!</h2>
        <div className="flex justify-center gap-8 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#22C55E]">{knownCount}</p>
            <p className="text-sm text-gray-500">Knew it</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#EF4444]">{unknownCount}</p>
            <p className="text-sm text-gray-500">Needs review</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-gray-500 font-medium">
          <span>
            Card {currentIndex + 1} of {totalCards}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-[#22C55E]">{knownCount} known</span>
            <span className="text-[#EF4444]">{unknownCount} missed</span>
          </span>
        </div>
        <ProgressBar value={completedCount} max={totalCards} className="h-2 rounded-full" />
      </div>

      {/* Flashcard */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: direction === 'right' ? -60 : direction === 'left' ? 60 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{
            opacity: 0,
            x: direction === 'right' ? 200 : direction === 'left' ? -200 : 0,
          }}
          transition={{ duration: 0.3 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="cursor-grab active:cursor-grabbing"
        >
          <div
            className="relative w-full h-64 md:h-80"
            style={{ perspective: '1000px' }}
            onClick={handleFlip}
          >
            <motion.div
              className="relative w-full h-full"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              {/* Front - Term */}
              <div
                className="absolute inset-0 rounded-2xl bg-white shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <RotateCcw className="w-5 h-5 text-gray-300 absolute top-4 right-4" />
                <p className="text-xl md:text-2xl font-bold text-gray-900 text-center">
                  {currentCard.term}
                </p>
                <p className="text-sm text-gray-400 mt-4">Tap to flip</p>
              </div>

              {/* Back - Definition */}
              <div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#6C63FF]/5 to-[#FF6B35]/5 shadow-lg border border-gray-100 flex flex-col items-center justify-center p-8"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <RotateCcw className="w-5 h-5 text-gray-300 absolute top-4 right-4" />
                <p className="text-lg md:text-xl text-gray-800 text-center leading-relaxed">
                  {currentCard.definition}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Swipe hints & buttons */}
      <div className="flex items-center justify-center gap-6">
        <Button
          onClick={() => advance(false)}
          className="flex items-center gap-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          <X className="w-5 h-5" />
          Didn&apos;t know
        </Button>
        <Button
          onClick={() => advance(true)}
          className="flex items-center gap-2 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          <Check className="w-5 h-5" />
          Knew it
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Swipe right if you knew it, left if you didn&apos;t
      </p>
    </div>
  );
}
