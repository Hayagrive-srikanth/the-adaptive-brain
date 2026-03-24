import { useProfileStore } from '@/stores/profileStore';

// Mock the API module
jest.mock('@/lib/api', () => ({
  usersApi: {
    getProfile: jest.fn(),
    completeOnboarding: jest.fn(),
    editProfile: jest.fn(),
  },
}));

import { usersApi } from '@/lib/api';

const mockedUsersApi = usersApi as jest.Mocked<typeof usersApi>;

beforeEach(() => {
  jest.clearAllMocks();
  useProfileStore.setState({
    profile: null,
    loading: false,
  });
});

describe('profileStore', () => {
  describe('fetchProfile()', () => {
    it('loads profile on success', async () => {
      const mockProfile = {
        learning_modality: 'visual',
        attention_span_minutes: 25,
        engagement_style: 'gamified',
      };
      mockedUsersApi.getProfile.mockResolvedValue({ profile: mockProfile } as any);

      await useProfileStore.getState().fetchProfile();

      expect(useProfileStore.getState().profile).toEqual(mockProfile);
      expect(useProfileStore.getState().loading).toBe(false);
    });

    it('handles error and sets loading false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedUsersApi.getProfile.mockRejectedValue(new Error('Failed'));

      await useProfileStore.getState().fetchProfile();

      expect(useProfileStore.getState().loading).toBe(false);
      expect(useProfileStore.getState().profile).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('submitOnboarding()', () => {
    it('posts answers and sets profile', async () => {
      const mockProfile = {
        learning_modality: 'audio',
        attention_span_minutes: 30,
      };
      mockedUsersApi.completeOnboarding.mockResolvedValue({ profile: mockProfile } as any);

      const answers = [
        { question_id: 1, answer: 'audio' },
        { question_id: 2, answer: '30' },
      ];

      await useProfileStore.getState().submitOnboarding(answers);

      expect(mockedUsersApi.completeOnboarding).toHaveBeenCalledWith(answers);
      expect(useProfileStore.getState().profile).toEqual(mockProfile);
      expect(useProfileStore.getState().loading).toBe(false);
    });
  });

  describe('updateProfile()', () => {
    it('updates profile with prompt', async () => {
      const updatedProfile = {
        learning_modality: 'reading',
        attention_span_minutes: 45,
      };
      mockedUsersApi.editProfile.mockResolvedValue({
        updated_profile: updatedProfile,
      } as any);

      const result = await useProfileStore.getState().updateProfile('Change to reading');

      expect(mockedUsersApi.editProfile).toHaveBeenCalledWith('Change to reading');
      expect(useProfileStore.getState().profile).toEqual(updatedProfile);
      expect(result).toEqual({ updated_profile: updatedProfile });
      expect(useProfileStore.getState().loading).toBe(false);
    });
  });
});
