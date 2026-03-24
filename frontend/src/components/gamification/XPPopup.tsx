'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPPopupProps {
  show: boolean;
  amount: number;
  multiplier?: number;
}

export default function XPPopup({ show, amount, multiplier }: XPPopupProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-24 left-1/2 z-50 pointer-events-none flex flex-col items-center"
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -40, x: '-50%' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.span
            className="text-3xl font-extrabold text-[#6C63FF] drop-shadow-lg"
            initial={{ scale: 0.5 }}
            animate={{ scale: [0.5, 1.2, 1] }}
            transition={{ duration: 0.4, times: [0, 0.6, 1] }}
          >
            +{amount} XP
          </motion.span>

          {multiplier && multiplier > 1 && (
            <motion.span
              className="text-lg font-bold text-[#FF6B35] mt-1"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [0, 1.3, 1] }}
              transition={{ delay: 0.2, duration: 0.4, times: [0, 0.6, 1] }}
            >
              {multiplier}x!
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
