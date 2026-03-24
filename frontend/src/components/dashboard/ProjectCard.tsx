'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, Trash2, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
}

function getDaysRemaining(examDate: string | Date): number {
  const now = new Date();
  const exam = new Date(examDate);
  const diff = exam.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatExamDate(examDate: string | Date): string {
  return new Date(examDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysBadgeColor(days: number): string {
  if (days < 3) return 'bg-red-100 text-red-700';
  if (days < 7) return 'bg-orange-100 text-orange-700';
  return 'bg-green-100 text-green-700';
}

function getReadinessColor(score: number): string {
  if (score < 30) return '#EF4444';
  if (score < 60) return '#F97316';
  if (score < 80) return '#EAB308';
  return '#22C55E';
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const daysRemaining = getDaysRemaining(project.examDate);
  const readiness = project.readinessScore ?? 0;
  const isCompleted = project.status === 'completed';

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(true);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteProject(project.id);
    } catch (err) {
      console.error('Failed to delete:', err);
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirm(false);
  };

  return (
    <Link href={`/project/${project.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Card className="relative p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100">
          {/* Delete button */}
          <button
            onClick={handleDelete}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors z-10"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Completed badge */}
          {isCompleted && (
            <div className="absolute top-3 right-12 flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </div>
          )}

          {/* Project name */}
          <h3 className="text-lg font-bold text-gray-800 mb-3 pr-20 leading-snug">
            {project.name}
          </h3>

          {/* Exam date and days remaining */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              {formatExamDate(project.examDate)}
            </div>

            {!isCompleted && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getDaysBadgeColor(daysRemaining)}`}
              >
                {daysRemaining > 0
                  ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`
                  : 'Past due'}
              </span>
            )}
          </div>

          {/* Readiness score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">
                Readiness
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: getReadinessColor(readiness) }}
              >
                {readiness}%
              </span>
            </div>
            <ProgressBar
              value={readiness}
              max={100}
              color={getReadinessColor(readiness)}
            />
          </div>

          {/* Delete confirmation overlay */}
          <AnimatePresence>
            {showConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-20"
                onClick={(e) => e.preventDefault()}
              >
                <p className="text-sm font-semibold text-gray-800">Delete this project?</p>
                <p className="text-xs text-gray-500 px-6 text-center">
                  This will archive &ldquo;{project.name}&rdquo; and remove it from your dashboard.
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </Link>
  );
}
