import { create } from 'zustand';
import { sessionsApi, quizApi } from '@/lib/api';
import type { StudySession, ContentBlock, QuizQuestion, QuizFeedback, SessionWrapUp, Topic } from '@/types';

interface SessionState {
  session: (StudySession & { projectId?: string }) | null;
  topics: Topic[];
  currentTopicIndex: number;
  currentContent: { content_blocks: ContentBlock[]; quiz_questions: QuizQuestion[] } | null;
  currentQuiz: QuizQuestion[];
  sessionProgress: { currentTopicIndex: number; totalTopics: number; questionsAnswered: number; correctAnswers: number };
  wrapUp: SessionWrapUp | null;
  loading: boolean;
  error: string | null;

  // Methods used by the session page
  fetchSession: (sessionId: string) => Promise<void>;
  getContentBlocks: (sessionId: string, topicId: string) => Promise<ContentBlock[]>;
  getQuizQuestions: (sessionId: string, topicId: string) => Promise<QuizQuestion[]>;
  completeSession: (sessionId: string, elapsedSeconds: number) => Promise<void>;

  // Methods used by other components
  startSession: (projectId: string, planDayId?: string) => Promise<StudySession>;
  endSession: (sessionId: string, topicsCovered: string[]) => Promise<SessionWrapUp>;
  fetchContent: (sessionId: string, topicId: string) => Promise<void>;
  submitAnswer: (data: { question_id: string; session_id: string; user_answer: string; time_taken_seconds?: number; hints_used?: number }) => Promise<QuizFeedback>;
  nextTopic: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  topics: [],
  currentTopicIndex: 0,
  currentContent: null,
  currentQuiz: [],
  sessionProgress: { currentTopicIndex: 0, totalTopics: 0, questionsAnswered: 0, correctAnswers: 0 },
  wrapUp: null,
  loading: false,
  error: null,

  fetchSession: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const sessionData = await sessionsApi.get(sessionId) as any;

      // Fetch topics for this project
      const projectId = sessionData.project_id;
      let topics: Topic[] = [];

      if (sessionData.topics && sessionData.topics.length > 0) {
        topics = sessionData.topics;
      } else if (projectId) {
        // Fetch topics from the project
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/topics`, {
            headers: {
              'Content-Type': 'application/json',
              ...(await getAuthHeader()),
            },
          });
          if (response.ok) {
            const data = await response.json();
            topics = data.topics || [];
          }
        } catch {
          // non-blocking
        }
      }

      set({
        session: { ...sessionData, projectId },
        topics,
        currentTopicIndex: 0,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load session', loading: false });
    }
  },

  getContentBlocks: async (sessionId, topicId) => {
    try {
      const content = await sessionsApi.getContent(sessionId, topicId) as any;
      const blocks = content.content_blocks || [];
      set({ currentContent: content, currentQuiz: content.quiz_questions || [] });
      return blocks;
    } catch (err: any) {
      console.error('Failed to get content blocks:', err);
      return [];
    }
  },

  getQuizQuestions: async (sessionId, topicId) => {
    try {
      // Quiz questions might already be loaded from getContentBlocks
      const state = get();
      if (state.currentQuiz && state.currentQuiz.length > 0) {
        return state.currentQuiz;
      }
      // Otherwise fetch them
      const content = await sessionsApi.getContent(sessionId, topicId) as any;
      const questions = content.quiz_questions || [];
      set({ currentQuiz: questions });
      return questions;
    } catch (err: any) {
      console.error('Failed to get quiz questions:', err);
      return [];
    }
  },

  completeSession: async (sessionId, elapsedSeconds) => {
    try {
      const state = get();
      const topicIds = state.topics.map((t) => t.id);
      const wrapUpData = await sessionsApi.end(sessionId, topicIds) as SessionWrapUp;
      set({ wrapUp: wrapUpData });
    } catch (err: any) {
      console.error('Failed to complete session:', err);
    }
  },

  startSession: async (projectId, planDayId) => {
    set({ loading: true });
    try {
      const session = await sessionsApi.start(projectId, planDayId) as any;
      const totalTopics = session.topics?.length || 0;
      set({
        session: { ...session, projectId },
        topics: session.topics || [],
        currentTopicIndex: 0,
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
      const wrapUpData = await sessionsApi.end(sessionId, topicsCovered) as SessionWrapUp;
      set({ wrapUp: wrapUpData });
      return wrapUpData;
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
      currentTopicIndex: state.currentTopicIndex + 1,
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
      session: null,
      topics: [],
      currentTopicIndex: 0,
      currentContent: null,
      currentQuiz: [],
      sessionProgress: { currentTopicIndex: 0, totalTopics: 0, questionsAnswered: 0, correctAnswers: 0 },
      wrapUp: null,
      loading: false,
      error: null,
    });
  },
}));

// Helper to get auth header
async function getAuthHeader(): Promise<Record<string, string>> {
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
