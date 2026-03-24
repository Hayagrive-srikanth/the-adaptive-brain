'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Flame,
  Sparkles,
  CalendarDays,
  LayoutGrid,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useGamificationStore } from '@/stores/gamificationStore';
import AuthGuard from '@/components/auth/AuthGuard';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import ProjectCard from '@/components/dashboard/ProjectCard';
import Card from '@/components/ui/Card';
import type { Project } from '@/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDaysUntilExam(examDate: string | Date): number {
  const now = new Date();
  const exam = new Date(examDate);
  return Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/*  Sparkline component (simple SVG)                                   */
/* ------------------------------------------------------------------ */

function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#6C63FF',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const trend = data[data.length - 1] - data[0];
  const strokeColor = trend > 0 ? '#22C55E' : trend < 0 ? '#EF4444' : color;

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot at the end */}
      {points.length > 0 && (
        <circle
          cx={parseFloat(points[points.length - 1].split(',')[0])}
          cy={parseFloat(points[points.length - 1].split(',')[1])}
          r={2}
          fill={strokeColor}
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Today's Priority section                                           */
/* ------------------------------------------------------------------ */

function TodaysPriority({ projects }: { projects: Project[] }) {
  const sorted = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active');
    return active
      .map((p) => ({ ...p, daysLeft: getDaysUntilExam(p.exam_date) }))
      .filter((p) => p.daysLeft > 0)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [projects]);

  if (sorted.length === 0) return null;

  const top = sorted[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-6"
    >
      <Card className="border-l-4 border-l-[#FF6B35] bg-gradient-to-r from-orange-50/50 to-white">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#FF6B35]/10">
            <AlertCircle className="w-5 h-5 text-[#FF6B35]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wide mb-1">
              Today&apos;s Priority
            </p>
            <Link
              href={`/project/${top.id}`}
              className="text-base font-bold text-gray-900 hover:text-[#6C63FF] transition-colors line-clamp-1"
            >
              {top.name}
            </Link>
            <p className="text-sm text-gray-500 mt-0.5">
              {top.daysLeft} day{top.daysLeft !== 1 ? 's' : ''} until exam
              {top.readiness_score != null && (
                <> &middot; {top.readiness_score}% ready</>
              )}
            </p>
          </div>
          <Link href={`/project/${top.id}`}>
            <Button size="sm" className="flex-shrink-0">
              Study Now
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar view                                                      */
/* ------------------------------------------------------------------ */

function CalendarView({ projects }: { projects: Project[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Collect exam dates and study plan dates as colored dots
  const dateDots = useMemo(() => {
    const dots: Record<number, string[]> = {};
    for (const project of projects) {
      const examDate = new Date(project.exam_date);
      if (examDate.getFullYear() === year && examDate.getMonth() === month) {
        const day = examDate.getDate();
        if (!dots[day]) dots[day] = [];
        dots[day].push('#FF6B35'); // exam day = orange
      }
    }
    // Mark today
    if (today.getFullYear() === year && today.getMonth() === month) {
      const day = today.getDate();
      if (!dots[day]) dots[day] = [];
      dots[day].push('#6C63FF');
    }
    return dots;
  }, [projects, year, month, today]);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8"
    >
      <Card>
        {/* Month header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonthOffset((p) => p - 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-bold text-gray-800">{monthName}</span>
          <button
            onClick={() => setMonthOffset((p) => p + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLabels.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            const dots = dateDots[day] ?? [];

            return (
              <div
                key={day}
                className={`h-9 flex flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                  isToday
                    ? 'bg-[#6C63FF]/10 font-bold text-[#6C63FF]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{day}</span>
                {dots.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dots.slice(0, 3).map((color, idx) => (
                      <span
                        key={idx}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#6C63FF]" /> Today
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FF6B35]" /> Exam day
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enhanced Project Card wrapper (with sparkline)                     */
/* ------------------------------------------------------------------ */

function EnhancedProjectCard({ project }: { project: Project }) {
  // Generate a mock trend for demonstration (in production, this would come from API)
  const trendData = useMemo(() => {
    const score = project.readiness_score ?? 0;
    // Simulate 7-day trend leading up to current score
    const base = Math.max(0, score - 15);
    return Array.from({ length: 7 }, (_, i) => {
      const progress = (i + 1) / 7;
      return Math.round(base + (score - base) * progress + (Math.random() - 0.5) * 5);
    });
  }, [project.readiness_score]);

  return (
    <div className="relative">
      <ProjectCard project={project} />
      {/* Sparkline overlay in bottom-right of card */}
      <div className="absolute bottom-4 right-4 opacity-60">
        <Sparkline data={trendData} width={64} height={20} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

/* ------------------------------------------------------------------ */
/*  Dashboard Content                                                  */
/* ------------------------------------------------------------------ */

function DashboardContent() {
  const { user } = useAuthStore();
  const { projects, loading, fetchProjects } = useProjectStore();
  const { xp, streak } = useGamificationStore();
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const greeting = useMemo(() => getGreeting(), []);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Top Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {greeting}, {user?.name ?? 'there'}!
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white rounded-full px-4 py-2 shadow-sm">
              <Sparkles className="w-4 h-4 text-[#6C63FF]" />
              <span className="text-sm font-semibold text-gray-700">
                {xp?.toLocaleString() ?? 0} XP
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white rounded-full px-4 py-2 shadow-sm">
              <Flame className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-sm font-semibold text-gray-700">
                {streak ?? 0} day streak
              </span>
            </div>
          </div>
        </motion.div>

        {/* Today's Priority */}
        {activeProjects.length > 0 && <TodaysPriority projects={projects} />}

        {/* Action row: Create + Calendar toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 flex items-center gap-3"
        >
          <Link href="/project/new">
            <Button className="inline-flex items-center gap-2 bg-[#6C63FF] hover:bg-[#5a52e0] text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              Create New Project
            </Button>
          </Link>

          <button
            onClick={() => setShowCalendar((p) => !p)}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
              showCalendar
                ? 'border-[#6C63FF] bg-[#6C63FF]/5 text-[#6C63FF]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {showCalendar ? (
              <>
                <LayoutGrid className="w-4 h-4" />
                Grid View
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" />
                Calendar
              </>
            )}
          </button>
        </motion.div>

        {/* Calendar View */}
        <AnimatePresence>
          {showCalendar && <CalendarView projects={projects} />}
        </AnimatePresence>

        {/* Projects Grid or Empty State */}
        {activeProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <EmptyState
              title="No projects yet"
              description="Ready to ace your next exam? Create your first study project."
              action={
                <Link href="/project/new">
                  <Button className="inline-flex items-center gap-2 bg-[#6C63FF] hover:bg-[#5a52e0] text-white font-semibold px-6 py-3 rounded-xl shadow-md">
                    <Plus className="w-5 h-5" />
                    Create Your First Project
                  </Button>
                </Link>
              }
            />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {activeProjects.map((project) => (
              <motion.div key={project.id} variants={itemVariants}>
                <EnhancedProjectCard project={project} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
