import { useSessionStore } from '@/stores/sessionStore';

// Mock the API module
jest.mock('@/lib/api', () => ({
  sessionsApi: {
    get: jest.fn(),
    start: jest.fn(),
    end: jest.fn(),
    getContent: jest.fn(),
  },
  quizApi: {
    submitAttempt: jest.fn(),
  },
}));

import { sessionsApi, quizApi } from '@/lib/api';

const mockedSessionsApi = sessionsApi as jest.Mocked<typeof sessionsApi>;
const mockedQuizApi = quizApi as jest.Mocked<typeof quizApi>;

beforeEach(() => {
  jest.clearAllMocks();
  useSessionStore.getState().resetSession();
});

describe('sessionStore', () => {
  describe('initial state', () => {
    it('has session as null', () => {
      expect(useSessionStore.getState().session).toBeNull();
    });

    it('has empty topics', () => {
      expect(useSessionStore.getState().topics).toEqual([]);
    });

    it('has wrapUp as null', () => {
      expect(useSessionStore.getState().wrapUp).toBeNull();
    });
  });

  describe('fetchSession()', () => {
    it('loads session and topics', async () => {
      const mockSession = {
        id: 'session-1',
        project_id: 'proj-1',
        topics: [{ id: 't1', name: 'Topic 1' }],
      };
      mockedSessionsApi.get.mockResolvedValue(mockSession as any);

      await useSessionStore.getState().fetchSession('session-1');

      const state = useSessionStore.getState();
      expect(state.session).toBeTruthy();
      expect(state.session?.id).toBe('session-1');
      expect(state.topics).toHaveLength(1);
      expect(state.loading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockedSessionsApi.get.mockRejectedValue(new Error('Session not found'));

      await useSessionStore.getState().fetchSession('bad-id');

      expect(useSessionStore.getState().error).toBe('Session not found');
      expect(useSessionStore.getState().loading).toBe(false);
    });
  });

  describe('startSession()', () => {
    it('creates session and sets state', async () => {
      const mockSession = {
        id: 'session-2',
        project_id: 'proj-1',
        topics: [{ id: 't1' }, { id: 't2' }],
      };
      mockedSessionsApi.start.mockResolvedValue(mockSession as any);

      const result = await useSessionStore.getState().startSession('proj-1');

      expect(result).toEqual(mockSession);
      expect(useSessionStore.getState().session).toBeTruthy();
      expect(useSessionStore.getState().topics).toHaveLength(2);
      expect(useSessionStore.getState().sessionProgress.totalTopics).toBe(2);
      expect(useSessionStore.getState().loading).toBe(false);
    });
  });

  describe('getContentBlocks()', () => {
    it('returns content blocks', async () => {
      const mockContent = {
        content_blocks: [{ id: 'cb1', content_type: 'summary' }],
        quiz_questions: [{ id: 'q1' }],
      };
      mockedSessionsApi.getContent.mockResolvedValue(mockContent as any);

      const blocks = await useSessionStore.getState().getContentBlocks('s1', 't1');

      expect(blocks).toHaveLength(1);
      expect(useSessionStore.getState().currentContent).toEqual(mockContent);
      expect(useSessionStore.getState().currentQuiz).toHaveLength(1);
    });

    it('returns empty array on error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedSessionsApi.getContent.mockRejectedValue(new Error('Failed'));

      const blocks = await useSessionStore.getState().getContentBlocks('s1', 't1');

      expect(blocks).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('getQuizQuestions()', () => {
    it('returns quiz questions from current state if available', async () => {
      useSessionStore.setState({
        currentQuiz: [{ id: 'q1', question_text: 'Test?' } as any],
      });

      const questions = await useSessionStore.getState().getQuizQuestions('s1', 't1');

      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe('q1');
    });

    it('fetches quiz questions if not already loaded', async () => {
      useSessionStore.setState({ currentQuiz: [] });
      const mockContent = {
        content_blocks: [],
        quiz_questions: [{ id: 'q2', question_text: 'Fetched?' }],
      };
      mockedSessionsApi.getContent.mockResolvedValue(mockContent as any);

      const questions = await useSessionStore.getState().getQuizQuestions('s1', 't1');

      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe('q2');
    });
  });

  describe('completeSession()', () => {
    it('sets wrapUp state', async () => {
      useSessionStore.setState({
        topics: [{ id: 't1' } as any],
      });
      const mockWrapUp = {
        session_id: 's1',
        xp_earned: 100,
        accuracy_percentage: 80,
      };
      mockedSessionsApi.end.mockResolvedValue(mockWrapUp as any);

      await useSessionStore.getState().completeSession('s1', 600);

      expect(useSessionStore.getState().wrapUp).toEqual(mockWrapUp);
    });
  });

  describe('submitAnswer()', () => {
    it('updates progress on correct answer', async () => {
      const mockFeedback = { correct: true, explanation: 'Good job!' };
      mockedQuizApi.submitAttempt.mockResolvedValue(mockFeedback as any);

      const feedback = await useSessionStore.getState().submitAnswer({
        question_id: 'q1',
        session_id: 's1',
        user_answer: 'A',
      });

      expect(feedback.correct).toBe(true);
      expect(useSessionStore.getState().sessionProgress.questionsAnswered).toBe(1);
      expect(useSessionStore.getState().sessionProgress.correctAnswers).toBe(1);
    });

    it('updates progress on incorrect answer', async () => {
      const mockFeedback = { correct: false, explanation: 'Wrong.' };
      mockedQuizApi.submitAttempt.mockResolvedValue(mockFeedback as any);

      await useSessionStore.getState().submitAnswer({
        question_id: 'q1',
        session_id: 's1',
        user_answer: 'B',
      });

      expect(useSessionStore.getState().sessionProgress.questionsAnswered).toBe(1);
      expect(useSessionStore.getState().sessionProgress.correctAnswers).toBe(0);
    });
  });

  describe('resetSession()', () => {
    it('clears all session state', () => {
      useSessionStore.setState({
        session: { id: 's1' } as any,
        topics: [{ id: 't1' } as any],
        currentContent: { content_blocks: [], quiz_questions: [] },
        currentQuiz: [{ id: 'q1' } as any],
        wrapUp: { session_id: 's1' } as any,
        loading: true,
        error: 'some error',
      });

      useSessionStore.getState().resetSession();

      const state = useSessionStore.getState();
      expect(state.session).toBeNull();
      expect(state.topics).toEqual([]);
      expect(state.currentContent).toBeNull();
      expect(state.currentQuiz).toEqual([]);
      expect(state.wrapUp).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentTopicIndex).toBe(0);
      expect(state.sessionProgress).toEqual({
        currentTopicIndex: 0,
        totalTopics: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
      });
    });
  });
});
