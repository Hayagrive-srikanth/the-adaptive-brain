import { useAuthStore } from '@/stores/authStore';
import { mockSupabase } from '../setup';

// Reset store state before each test
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    session: null,
    loading: false,
  });
});

describe('authStore', () => {
  describe('initial state', () => {
    it('has user as null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('has loading as false', () => {
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('has session as null', () => {
      expect(useAuthStore.getState().session).toBeNull();
    });
  });

  describe('initialize()', () => {
    it('sets user from session when session exists', async () => {
      const mockSession = { access_token: 'test-token', user: { id: 'user-1' } };
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUser }),
          }),
        }),
      });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().session).toEqual(mockSession);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('sets loading to false when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
      });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe('signIn()', () => {
    it('calls supabase signInWithPassword', async () => {
      const mockSession = { access_token: 'token' };
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'user-1', name: 'User' } }),
          }),
        }),
      });

      await useAuthStore.getState().signIn('test@test.com', 'password');

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password',
      });
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it('throws error when supabase returns error', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        useAuthStore.getState().signIn('bad@test.com', 'wrong')
      ).rejects.toEqual({ message: 'Invalid credentials' });
    });
  });

  describe('signUp()', () => {
    it('calls supabase auth signUp', async () => {
      const mockData = {
        user: { id: 'new-user' },
        session: { access_token: 'token' },
      };
      mockSupabase.auth.signUp.mockResolvedValue({ data: mockData, error: null });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'new-user' } },
      });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'new-user', name: 'New User' } }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await useAuthStore.getState().signUp('new@test.com', 'password', 'New User');

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'password',
      });
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe('signOut()', () => {
    it('clears user and session state', async () => {
      useAuthStore.setState({
        user: { id: 'user-1', email: 'test@test.com' } as any,
        session: { access_token: 'token' },
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().session).toBeNull();
    });
  });
});
