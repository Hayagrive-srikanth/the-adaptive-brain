import { create } from 'zustand';
import { sessionsApi, quizApi } from '@/lib/api';
import type { StudySession, ContentBlock, QuizQuestion, QuizFeedback, SessionWrapUp } from '@/types';

interface SessionState {
  currentSession: StudySession | null;
  currentContent: { content_blocks: ContentBlock[]; quiz_questions: QuizQuestion[] } | null;
  currentQuiz: QuizQuestion[];
  sessionProgress: { currentTopicIndex: number; totalTopics: number; questionsAnswered: number; correctAnswers: number };
  loading: boolean;
  startSession: (projectId: string, planDayId?: string) => Promise<StudySession>;
  endSession: (sessionId: string, topicsCovered: string[]) => Promise<SessionWrapUp>;
  fetchContent: (sessionId: string, topicId: string) => Promise<void>;
  submitAnswer: (data: { question_id: string; session_id: string; user_answer: string; time_taken_seconds?: number; hints_used?: number }) => Promise<QuizFeedback>;
  nextTopic: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  currentContent: null,
  currentQuiz: [],
  sessionProgress: { currentTopicIndex: 0, totalTopics: 0, questionsAnswered: 0, correctAnswers: 0 },
  loading: false,

  startSession: async (projectId, planDayId) => {
    set({ loading: true });
    try {
      const session = await sessionsApi.start(projectId, planDayId) as any;
      const totalTopics = session.topics?.length || 0;
      set({
        currentSession: session,
        sessionProgress: { currentTopicIndex: 0, totalTopics, questionsAnswered: 0, correctAnswers: 0 },
      });
      return session;
    } finally {
      set({ loading: false });
    }
  },

  endSession: async (sessionId, topicsCovered) => {
    set({ loading: true });
    try {
      const wrapUp = await sessionsApi.end(sessionId, topicsCovered) as SessionWrapUp;
      return wrapUp;
    } finally {
      set({ loading: false });
    }
  },

  fetchContent: async (sessionId, topicId) => {
    set({ loading: true });
    try {
      const content = await sessionsApi.getContent(sessionId, topicId) as any;
      set({
        currentContent: content,
        currentQuiz: content.quiz_questions || [],
      });
    } finally {
      set({ loading: false });
    }
  },

  submitAnswer: async (data) => {
    const feedback = await quizApi.submitAttempt(data) as QuizFeedback;
    set((state) => ({
      sessionProgress: {
        ...state.sessionProgress,
        questionsAnswered: state.sessionProgress.questionsAnswered + 1,
        correctAnswers: state.sessionProgress.correctAnswers + (feedback.correct ? 1 : 0),
      },
    }));
    return feedback;
  },

  nextTopic: () => {
    set((state) => ({
      sessionProgress: {
        ...state.sessionProgress,
        currentTopicIndex: state.sessionProgress.currentTopicIndex + 1,
      },
      currentContent: null,
      currentQuiz: [],
    }));
  },

  resetSession: () => {
    set({
      currentSession: null,
      currentContent: null,
      currentQuiz: [],
      sessionProgress: { currentTopicIndex: 0, totalTopics: 0, questionsAnswered: 0, correctAnswers: 0 },
    });
  },
}));
