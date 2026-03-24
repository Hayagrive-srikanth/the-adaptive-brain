'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

interface NotificationData {
  title: string;
  body: string;
  action?: {
    label: string;
    href?: string;
  };
}

interface NotificationBannerProps {
  notification: NotificationData;
  onDismiss: () => void;
  onAction?: () => void;
}

export default function NotificationBanner({
  notification,
  onDismiss,
  onAction,
}: NotificationBannerProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -60 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
    >
      <div
        onClick={onDismiss}
        className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 cursor-pointer hover:shadow-xl transition-shadow"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              {notification.title}
            </p>
            <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">
              {notification.body}
            </p>
            {notification.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.();
                }}
                className="inline-flex items-center gap-1 mt-2 text-sm text-[#6C63FF] hover:text-[#5B54E6] font-medium transition-colors"
              >
                {notification.action.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
