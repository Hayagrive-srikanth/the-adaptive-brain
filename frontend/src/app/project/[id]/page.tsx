'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar } from 'lucide-react';

import AuthGuard from '@/components/auth/AuthGuard';
import { Spinner } from '@/components/ui/Loader';
import Button from '@/components/ui/Button';
import ReadinessScore from '@/components/project/ReadinessScore';
import TodaySession from '@/components/project/TodaySession';
import StudyPath from '@/components/project/StudyPath';
import TopicMap from '@/components/project/TopicMap';
import ExamEve from '@/components/project/ExamEve';
import PostExam from '@/components/project/PostExam';
import StudyWrapped from '@/components/project/StudyWrapped';
import { useProjectStore } from '@/stores/projectStore';
import { useSessionStore } from '@/stores/sessionStore';

function formatExamDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const {
    currentProject,
    topics,
    studyPlan,
    loading,
    fetchProject,
    fetchTopics,
    fetchPlan,
  } = useProjectStore();

  const { startSession } = useSessionStore();
  const [showWrapped, setShowWrapped] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchTopics(projectId);
      fetchPlan(projectId);
    }
  }, [projectId, fetchProject, fetchTopics, fetchPlan]);

  // Find today's plan day
  const todayPlanDay = useMemo(() => {
    if (!studyPlan?.days) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    return studyPlan.days.find((d) => d.date === todayStr) ?? null;
  }, [studyPlan]);

  // Build ExamEve props from available data — must be before any early returns
  const weakTopics = useMemo(() => {
    return [...topics]
      .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
      .slice(0, 5)
      .map((t) => ({ id: t.id, name: t.name, mastery: t.mastery ?? 0 }));
  }, [topics]);

  // Wrapped data placeholder — must be before any early returns
  const wrappedData = useMemo(
    () => ({
      totalHoursStudied: currentProject?.total_hours_studied ?? 0,
      topicsMastered: topics.filter((t) => (t.mastery ?? 0) >= 80).length,
      questionsAnswered: currentProject?.questions_answered ?? 0,
      longestStreak: currentProject?.longest_streak ?? 0,
      studyPersonality: currentProject?.study_personality ?? 'A dedicated learner',
      strongestTopic:
        [...topics].sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0))[0]
          ?.name ?? 'N/A',
      mostImprovedTopic: currentProject?.most_improved_topic ?? 'N/A',
      readinessScore: currentProject?.readiness_score ?? 0,
    }),
    [currentProject, topics],
  );

  const handleStartSession = async () => {
    try {
      const session = await startSession(projectId, todayPlanDay?.id);
      router.push(`/session/${session.id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleSelectTopic = (topicId: string) => {
    router.push(`/project/${projectId}/topic/${topicId}`);
  };

  if (loading && !currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
        <p className="text-gray-500">Project not found.</p>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const examDaysLeft = daysUntil(currentProject.exam_date);
  const isExamTomorrow = examDaysLeft === 1;
  const isExamPassed = examDaysLeft < 0;

  // If wrapped is showing, render full-screen overlay
  if (showWrapped) {
    return <StudyWrapped wrappedData={wrappedData} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </motion.div>

        {/* Header: project name + exam date + readiness */}
        <motion.div
          className="flex items-start justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1 truncate">
              {currentProject.name}
            </h1>
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-sm">
                {formatExamDate(currentProject.exam_date)}
              </span>
              {examDaysLeft > 0 && (
                <span className="text-xs px-2 py-0.5 bg-[#FF6B35]/10 text-[#FF6B35] font-semibold rounded-full">
                  {examDaysLeft} day{examDaysLeft !== 1 ? 's' : ''} left
                </span>
              )}
            </div>
          </div>

          <ReadinessScore score={currentProject.readiness_score} />
        </motion.div>

        {/* Exam Eve card — shows when exam is tomorrow */}
        {isExamTomorrow && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <ExamEve
              project={{
                id: projectId,
                name: currentProject.name,
                stats: {
                  totalHoursStudied: currentProject.total_hours_studied ?? 0,
                  topicsMastered: topics.filter((t) => (t.mastery ?? 0) >= 80).length,
                  readinessScore: currentProject.readiness_score ?? 0,
                },
              }}
              weakTopics={weakTopics}
            />
          </motion.div>
        )}

        {/* Post-Exam reflection — shows after exam date has passed */}
        {isExamPassed && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <PostExam
              projectId={projectId}
              onComplete={() => setShowWrapped(true)}
            />
          </motion.div>
        )}

        {/* Today's session */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <TodaySession
            planDay={todayPlanDay}
            topics={topics}
            projectId={projectId}
            onStartSession={handleStartSession}
          />
        </motion.div>

        {/* Study Path */}
        {topics.length > 0 && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <StudyPath topics={topics} onSelectTopic={handleSelectTopic} />
          </motion.div>
        )}

        {/* Topic Map */}
        {topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <TopicMap topics={topics} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <AuthGuard>
      <ProjectDashboard />
    </AuthGuard>
  );
}
