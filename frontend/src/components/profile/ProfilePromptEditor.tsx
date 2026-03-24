'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '@/stores/profileStore';
import { Send, Check, Loader2 } from 'lucide-react';

export function ProfilePromptEditor() {
  const { updateProfile, loading } = useProfileStore();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{
    interpretation: string;
    fields_changed: Record<string, any>;
  } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setError('');
    setResult(null);

    try {
      const response = await updateProfile(prompt.trim());
      setResult({
        interpretation: response.interpretation,
        fields_changed: response.fields_changed,
      });
      setPrompt('');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Edit Your Profile</h3>
      <p className="text-sm text-gray-500">
        Tell us what to change in plain English
      </p>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'I actually prefer shorter sessions' or 'I study best late at night'"
          className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent transition-all"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg bg-[#6C63FF] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#5A52D5] transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 border border-green-200 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-800">Profile Updated</span>
            </div>
            <p className="text-sm text-green-700">{result.interpretation}</p>
            {Object.keys(result.fields_changed).length > 0 && (
              <div className="mt-3 space-y-1">
                {Object.entries(result.fields_changed).map(([field, change]: [string, any]) => (
                  <div key={field} className="text-xs text-green-600">
                    <span className="font-medium">{field}</span>:{' '}
                    <span className="line-through opacity-60">{String(change.before)}</span>
                    {' → '}
                    <span className="font-semibold">{String(change.after)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4"
          >
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
