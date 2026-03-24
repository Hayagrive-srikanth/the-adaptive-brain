'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface PausePoint {
  timestamp: number;
  question: string;
}

interface AudioPlayerProps {
  audioUrl: string;
  pausePoints?: PausePoint[];
  onQuizAnswer?: (timestamp: number, answer: string) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function AudioPlayer({
  audioUrl,
  pausePoints = [],
  onQuizAnswer,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // default 1x
  const [activePausePoint, setActivePausePoint] = useState<PausePoint | null>(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [triggeredPoints, setTriggeredPoints] = useState<Set<number>>(new Set());

  const speed = SPEEDS[speedIndex];

  // Time update handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Check for pause points
      for (const point of pausePoints) {
        if (
          !triggeredPoints.has(point.timestamp) &&
          audio.currentTime >= point.timestamp &&
          audio.currentTime < point.timestamp + 1
        ) {
          audio.pause();
          setIsPlaying(false);
          setActivePausePoint(point);
          setTriggeredPoints((prev) => new Set([...prev, point.timestamp]));
          break;
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [pausePoints, triggeredPoints]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSpeedChange = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIndex];
    }
  }, [speedIndex]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;

      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = clickX / rect.width;
      audio.currentTime = ratio * duration;
    },
    [duration]
  );

  const handleSkip = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
    },
    [duration]
  );

  const handleQuizSubmit = useCallback(() => {
    if (!activePausePoint || !quizAnswer.trim()) return;
    onQuizAnswer?.(activePausePoint.timestamp, quizAnswer);
    setActivePausePoint(null);
    setQuizAnswer('');
    // Resume playback
    const audio = audioRef.current;
    if (audio) {
      audio.play();
      setIsPlaying(true);
    }
  }, [activePausePoint, quizAnswer, onQuizAnswer]);

  const handleSkipQuiz = useCallback(() => {
    setActivePausePoint(null);
    setQuizAnswer('');
    const audio = audioRef.current;
    if (audio) {
      audio.play();
      setIsPlaying(true);
    }
  }, []);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <Card className="p-5">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative h-2 bg-gray-200 rounded-full cursor-pointer mb-4 group"
          onClick={handleProgressClick}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#6C63FF] rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Pause point markers */}
          {pausePoints.map((point, i) => {
            const pos = duration > 0 ? (point.timestamp / duration) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#FF6B35] rounded-full border-2 border-white shadow-sm"
                style={{ left: `${pos}%` }}
                title={point.question}
              />
            );
          })}
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#6C63FF] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPercent}%`, marginLeft: '-8px' }}
          />
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleSkip(-10)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 bg-[#6C63FF] hover:bg-[#5B54E6] text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleSkip(10)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Speed control */}
          <button
            onClick={handleSpeedChange}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-600 transition-colors min-w-[60px]"
          >
            {speed}x
          </button>
        </div>
      </Card>

      {/* Quiz overlay at pause point */}
      <AnimatePresence>
        {activePausePoint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-20"
          >
            <Card className="p-6 bg-white/95 backdrop-blur-sm shadow-xl border-2 border-[#6C63FF]/20">
              <div className="mb-1 text-xs text-[#6C63FF] font-semibold uppercase tracking-wide">
                Quick Check
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-4">
                {activePausePoint.question}
              </p>
              <input
                type="text"
                value={quizAnswer}
                onChange={(e) => setQuizAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-800 focus:border-[#6C63FF] focus:outline-none transition-colors mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quizAnswer.trim()) {
                    handleQuizSubmit();
                  }
                }}
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleQuizSubmit}
                  disabled={!quizAnswer.trim()}
                  className="flex-1 bg-[#6C63FF] hover:bg-[#5B54E6] disabled:bg-gray-300 text-white py-2.5 rounded-xl font-semibold transition-colors"
                >
                  Submit
                </Button>
                <button
                  onClick={handleSkipQuiz}
                  className="px-4 py-2.5 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Skip
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
