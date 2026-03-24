import { create } from 'zustand';
import { usersApi } from '@/lib/api';

interface GamificationState {
  xp: number;
  streak: number;
  longestStreak: number;
  achievements: any[];
  loading: boolean;
  fetchStats: () => Promise<void>;
  addXP: (amount: number) => void;
  updateStreak: (streak: number) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  xp: 0,
  streak: 0,
  longestStreak: 0,
  achievements: [],
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const stats: any = await usersApi.getStats();
      set({
        xp: stats.total_xp || 0,
        streak: stats.current_streak || 0,
        longestStreak: stats.longest_streak || 0,
      });
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      set({ loading: false });
    }
  },

  addXP: (amount) => {
    set((state) => ({ xp: state.xp + amount }));
  },

  updateStreak: (streak) => {
    set((state) => ({
      streak,
      longestStreak: Math.max(state.longestStreak, streak),
    }));
  },
}));
