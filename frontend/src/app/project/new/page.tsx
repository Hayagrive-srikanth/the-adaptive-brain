'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Image,
  File,
  CheckCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { materialsApi } from '@/lib/api';
import type { Project, SourceMaterial } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const STEPS = ['Details', 'Upload', 'Processing', 'Ready'];

const ACCEPTED_TYPES =
  '.pdf,.png,.jpg,.jpeg,.docx,.pptx,.mp3,.wav';

const COMFORT_OPTIONS: { label: string; value: string; emoji: string; desc: string }[] = [
  {
    label: 'Starting from scratch',
    value: 'beginner',
    emoji: '🌱',
    desc: 'I have no prior knowledge of this subject',
  },
  {
    label: 'I know the basics',
    value: 'intermediate',
    emoji: '📚',
    desc: 'I have some understanding but need to deepen it',
  },
  {
    label: 'Just need to review',
    value: 'review',
    emoji: '🔄',
    desc: "I've studied this before and need a refresher",
  },
];

const PROCESSING_MESSAGES = [
  'Reading through your notes...',
  'Analyzing content...',
  'Extracting topics...',
  'Building your study plan...',
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return <Image className="h-5 w-5 text-pink-500" />;
  if (['pdf', 'docx', 'pptx'].includes(ext)) return <FileText className="h-5 w-5 text-blue-500" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

/* -------------------------------------------------------------------------- */
/*  Slide animation variants                                                   */
/* -------------------------------------------------------------------------- */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function NewProjectPage() {
  const router = useRouter();

  /* ---- wizard state ---- */
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  /* ---- step 1 state ---- */
  const [projectName, setProjectName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [comfortLevel, setComfortLevel] = useState('');

  /* ---- step 2 state ---- */
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- step 3 state ---- */
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0]);
  const [allProcessed, setAllProcessed] = useState(false);

  /* ---- step 4 state ---- */
  const [topicCount, setTopicCount] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  /* ---- project ref ---- */
  const [createdProject, setCreatedProject] = useState<Project | null>(null);

  /* ---- store ---- */
  const { createProject, uploadMaterial, materials, generateTopics, fetchTopics, topics } =
    useProjectStore();

  /* ---- navigation helpers ---- */
  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  /* ---- step 1 validation ---- */
  const step1Valid = projectName.trim() !== '' && examDate !== '' && comfortLevel !== '';

  /* ---- step 2: file handling ---- */
  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragActive(false), []);

  /* ---- step 2 -> 3 transition: create project + upload ---- */
  const handleUploadAndProceed = useCallback(async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let project = createdProject;
      if (!project) {
        project = await createProject({
          name: projectName,
          exam_date: examDate,
          hours_per_day: hoursPerDay,
          comfort_level: comfortLevel,
        });
        setCreatedProject(project);
      }
      await uploadMaterial(project.id, files);
      goNext();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [
    files,
    createdProject,
    createProject,
    projectName,
    examDate,
    hoursPerDay,
    comfortLevel,
    uploadMaterial,
    goNext,
  ]);

  /* ---- step 3: polling ---- */
  useEffect(() => {
    if (step !== 2) return;

    /* cycle through friendly messages */
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROCESSING_MESSAGES.length;
      setProcessingMsg(PROCESSING_MESSAGES[msgIdx]);
    }, 3500);

    /* poll material status */
    const pollTimer = setInterval(async () => {
      if (!createdProject) return;
      try {
        const statuses = await Promise.all(
          materials.map((m: SourceMaterial) => materialsApi.getStatus(m.id)),
        );
        const done = statuses.every(
          (s: any) => s.processing_status === 'completed',
        );
        if (done) {
          setAllProcessed(true);
          clearInterval(pollTimer);
          clearInterval(msgTimer);

          /* trigger topic generation */
          await generateTopics(createdProject.id);
          await fetchTopics(createdProject.id);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);

    return () => {
      clearInterval(msgTimer);
      clearInterval(pollTimer);
    };
  }, [step, createdProject, materials, generateTopics, fetchTopics]);

  /* ---- step 3 -> 4 auto-advance ---- */
  useEffect(() => {
    if (!allProcessed) return;
    const timer = setTimeout(() => {
      setTopicCount(topics.length);
      setTotalDays(examDate ? daysUntil(examDate) : 0);
      goNext();
    }, 1800);
    return () => clearTimeout(timer);
  }, [allProcessed, topics, examDate, goNext]);

  /* ======================================================================== */
  /*  Render                                                                   */
  /* ======================================================================== */

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* ---- progress dots ---- */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 && (
                  <div
                    className={`h-0.5 w-8 rounded-full transition-colors duration-300 ${
                      i <= step ? 'bg-[#6C63FF]' : 'bg-gray-300'
                    }`}
                  />
                )}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    i < step
                      ? 'bg-[#6C63FF] text-white'
                      : i === step
                        ? 'bg-[#6C63FF] text-white shadow-lg shadow-[#6C63FF]/30'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
              </React.Fragment>
            ))}
          </div>
          <ProgressBar value={(step / (STEPS.length - 1)) * 100} height={4} />
        </div>

        {/* ---- step content ---- */}
        <AnimatePresence mode="wait" custom={direction}>
          {/* ============================================================= */}
          {/*  STEP 1 - Project Details                                      */}
          {/* ============================================================= */}
          {step === 0 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Create a new project
                  </h1>
                  <p className="mt-1 text-gray-500">
                    Tell us about what you&apos;re studying.
                  </p>
                </div>

                {/* Project name */}
                <div>
                  <label
                    htmlFor="project-name"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Project name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    placeholder="e.g. Biology Final Exam"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 transition-all"
                  />
                </div>

                {/* Exam date */}
                <div>
                  <label
                    htmlFor="exam-date"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Exam date
                  </label>
                  <input
                    id="exam-date"
                    type="date"
                    value={examDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 transition-all"
                  />
                  {examDate && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 flex items-center gap-1.5 text-sm text-[#6C63FF] font-medium"
                    >
                      <Clock className="h-4 w-4" />
                      {daysUntil(examDate)} days remaining
                    </motion.p>
                  )}
                </div>

                {/* Hours per day */}
                <div>
                  <label
                    htmlFor="hours-per-day"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Hours per day{' '}
                    <span className="text-gray-400 font-normal">({hoursPerDay}h)</span>
                  </label>
                  <input
                    id="hours-per-day"
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 transition-all"
                  />
                </div>

                {/* Comfort level */}
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    How comfortable are you with this material?
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {COMFORT_OPTIONS.map((opt) => (
                      <motion.button
                        key={opt.value}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setComfortLevel(opt.value)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all duration-200 ${
                          comfortLevel === opt.value
                            ? 'border-[#6C63FF] bg-[#6C63FF]/5 shadow-md shadow-[#6C63FF]/10'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {opt.label}
                        </span>
                        <span className="text-xs text-gray-500 leading-snug">
                          {opt.desc}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Next button */}
                <div className="flex justify-end pt-2">
                  <Button
                    size="lg"
                    disabled={!step1Valid}
                    onClick={goNext}
                  >
                    Next
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ============================================================= */}
          {/*  STEP 2 - Material Upload                                      */}
          {/* ============================================================= */}
          {step === 1 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Upload your materials
                  </h1>
                  <p className="mt-1 text-gray-500">
                    Add your notes, textbooks, slides, or audio recordings.
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all duration-200 ${
                    dragActive
                      ? 'border-[#6C63FF] bg-[#6C63FF]/5'
                      : 'border-gray-300 bg-gray-50 hover:border-[#6C63FF]/50 hover:bg-[#6C63FF]/[0.02]'
                  }`}
                >
                  <motion.div
                    animate={dragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <Upload className="h-10 w-10 text-[#6C63FF]/60" />
                  </motion.div>
                  <p className="text-center text-sm text-gray-600">
                    <span className="font-semibold text-[#6C63FF]">
                      Drag & drop files here
                    </span>
                    <br />
                    or click to browse
                  </p>
                  <p className="text-xs text-gray-400">
                    PDF, Images, DOCX, PPTX, Audio
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES}
                    onChange={(e) => addFiles(e.target.files)}
                    className="hidden"
                  />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2"
                  >
                    {files.map((f, idx) => (
                      <motion.li
                        key={`${f.name}-${idx}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3"
                      >
                        {fileIcon(f.name)}
                        <span className="flex-1 truncate text-sm font-medium text-gray-700">
                          {f.name}
                        </span>
                        <Clock className="h-4 w-4 text-gray-400" />
                      </motion.li>
                    ))}
                  </motion.ul>
                )}

                {/* Nav buttons */}
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </Button>
                  <Button
                    size="lg"
                    disabled={files.length === 0 || uploading}
                    loading={uploading}
                    onClick={handleUploadAndProceed}
                  >
                    {uploading ? 'Uploading...' : 'Next'}
                    {!uploading && <ArrowRight className="h-5 w-5" />}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ============================================================= */}
          {/*  STEP 3 - Processing                                           */}
          {/* ============================================================= */}
          {step === 2 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card className="flex flex-col items-center py-16 text-center">
                {!allProcessed ? (
                  <>
                    {/* Pulsing brain animation */}
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#6C63FF]/10"
                    >
                      <motion.span
                        className="text-5xl"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        🧠
                      </motion.span>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      <motion.p
                        key={processingMsg}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                        className="text-lg font-medium text-gray-700"
                      >
                        {processingMsg}
                      </motion.p>
                    </AnimatePresence>

                    {/* material progress */}
                    {materials.length > 0 && (
                      <div className="mt-8 w-full max-w-sm space-y-2">
                        {materials.map((m: SourceMaterial) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2 text-sm"
                          >
                            {fileIcon(m.original_filename)}
                            <span className="flex-1 truncate text-gray-600">
                              {m.original_filename}
                            </span>
                            {m.processing_status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : m.processing_status === 'processing' ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              >
                                <Clock className="h-4 w-4 text-[#6C63FF]" />
                              </motion.div>
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-10 w-10 text-green-500" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900">
                      Materials processed!
                    </p>
                  </motion.div>
                )}

                {/* Back button */}
                {!allProcessed && (
                  <div className="mt-10">
                    <Button variant="ghost" onClick={goBack}>
                      <ArrowLeft className="h-5 w-5" />
                      Back
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* ============================================================= */}
          {/*  STEP 4 - The Magic Moment                                     */}
          {/* ============================================================= */}
          {step === 3 && (
            <motion.div
              key="step-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <Card className="flex flex-col items-center py-16 text-center">
                {/* Celebration animation */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  className="mb-6 text-6xl"
                >
                  🎉
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-3xl font-bold text-gray-900"
                >
                  Your study plan is ready!
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-3 text-lg text-gray-600"
                >
                  I found{' '}
                  <span className="font-bold text-[#6C63FF]">{topicCount} topics</span>{' '}
                  in your materials. Here&apos;s your{' '}
                  <span className="font-bold text-[#FF6B35]">{totalDays}-day</span> plan.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-10 flex flex-col items-center gap-4"
                >
                  <Button
                    size="lg"
                    onClick={() =>
                      router.push(`/project/${createdProject?.id}`)
                    }
                    className="px-10 shadow-lg shadow-[#6C63FF]/25"
                  >
                    Start Day 1
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="h-5 w-5" />
                    Back
                  </Button>
                </motion.div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
