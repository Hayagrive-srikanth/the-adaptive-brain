import { mockSupabase } from '../setup';

// We need to test the actual api module, so import it after setup mocks are in place
import { projectsApi, sessionsApi, quizApi } from '@/lib/api';

const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'test-token-123' } },
  });
});

describe('api module', () => {
  describe('request() auth headers', () => {
    it('adds Authorization header when session has token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ projects: [] }),
      });

      await projectsApi.list();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      });
    });

    it('omits Authorization header when no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ projects: [] }),
      });

      await projectsApi.list();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });
  });

  describe('request() error handling', () => {
    it('throws on non-ok response with detail message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ detail: 'Project not found' }),
      });

      await expect(projectsApi.get('bad-id')).rejects.toThrow('Project not found');
    });

    it('throws with HTTP status when no detail in response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('parse error')),
      });

      await expect(projectsApi.get('bad-id')).rejects.toThrow('Request failed');
    });
  });

  describe('projectsApi.create()', () => {
    it('sends correct POST request', async () => {
      const projectData = {
        name: 'Test Project',
        exam_date: '2026-04-01',
        hours_per_day: 3,
        comfort_level: 'intermediate',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: '1', ...projectData }),
      });

      await projectsApi.create(projectData);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/projects');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(projectData);
    });
  });

  describe('projectsApi.list()', () => {
    it('sends correct GET request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ projects: [] }),
      });

      await projectsApi.list();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/projects');
      expect(options.method).toBeUndefined(); // GET is default
    });
  });

  describe('projectsApi.archive()', () => {
    it('sends correct DELETE request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await projectsApi.archive('proj-123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/projects/proj-123');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('sessionsApi.start()', () => {
    it('sends correct POST body with project_id', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 's1' }),
      });

      await sessionsApi.start('proj-1', 'day-1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/sessions/start');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.project_id).toBe('proj-1');
      expect(body.plan_day_id).toBe('day-1');
    });

    it('sends undefined plan_day_id when not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 's1' }),
      });

      await sessionsApi.start('proj-1');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.project_id).toBe('proj-1');
    });
  });

  describe('quizApi.submitAttempt()', () => {
    it('sends correct POST with attempt data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ correct: true }),
      });

      const attemptData = {
        question_id: 'q1',
        session_id: 's1',
        user_answer: 'Option A',
        time_taken_seconds: 15,
        hints_used: 0,
      };

      await quizApi.submitAttempt(attemptData);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/quiz/attempt');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(attemptData);
    });
  });
});
