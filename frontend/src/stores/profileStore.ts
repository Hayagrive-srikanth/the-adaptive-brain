import { create } from 'zustand';
import { usersApi } from '@/lib/api';
import type { UserProfile } from '@/types';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (prompt: string) => Promise<any>;
  submitOnboarding: (answers: { question_id: number; answer: string }[]) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,

  fetchProfile: async () => {
    set({ loading: true });
    try {
      const data: any = await usersApi.getProfile();
      set({ profile: data.profile });
    } catch (error) {
      console.error('Fetch profile error:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (prompt: string) => {
    set({ loading: true });
    try {
      const result: any = await usersApi.editProfile(prompt);
      set({ profile: result.updated_profile });
      return result;
    } finally {
      set({ loading: false });
    }
  },

  submitOnboarding: async (answers) => {
    set({ loading: true });
    try {
      const result: any = await usersApi.completeOnboarding(answers);
      set({ profile: result.profile });
    } finally {
      set({ loading: false });
    }
  },
}));
