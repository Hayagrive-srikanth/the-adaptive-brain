import { useProjectStore } from '@/stores/projectStore';

// Mock the API module
jest.mock('@/lib/api', () => ({
  projectsApi: {
    list: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    archive: jest.fn(),
  },
  materialsApi: {
    upload: jest.fn(),
    list: jest.fn(),
  },
  topicsApi: {
    list: jest.fn(),
    generate: jest.fn(),
  },
  plansApi: {
    get: jest.fn(),
  },
}));

import { projectsApi } from '@/lib/api';

const mockedProjectsApi = projectsApi as jest.Mocked<typeof projectsApi>;

beforeEach(() => {
  jest.clearAllMocks();
  useProjectStore.setState({
    projects: [],
    currentProject: null,
    materials: [],
    topics: [],
    studyPlan: null,
    loading: false,
  });
});

describe('projectStore', () => {
  describe('fetchProjects()', () => {
    it('populates projects array on success', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1' },
        { id: '2', name: 'Project 2' },
      ];
      mockedProjectsApi.list.mockResolvedValue({ projects: mockProjects } as any);

      await useProjectStore.getState().fetchProjects();

      expect(useProjectStore.getState().projects).toEqual(mockProjects);
      expect(useProjectStore.getState().loading).toBe(false);
    });

    it('handles error and sets loading false', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedProjectsApi.list.mockRejectedValue(new Error('Network error'));

      await useProjectStore.getState().fetchProjects();

      expect(useProjectStore.getState().loading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('createProject()', () => {
    it('adds created project to projects array', async () => {
      const newProject = { id: '3', name: 'New Project' };
      mockedProjectsApi.create.mockResolvedValue(newProject as any);

      const result = await useProjectStore.getState().createProject({
        name: 'New Project',
        exam_date: '2026-04-01',
        hours_per_day: 2,
        comfort_level: 'beginner',
      });

      expect(result).toEqual(newProject);
      expect(useProjectStore.getState().projects).toContainEqual(newProject);
      expect(useProjectStore.getState().loading).toBe(false);
    });
  });

  describe('deleteProject()', () => {
    it('removes project from projects array', async () => {
      useProjectStore.setState({
        projects: [
          { id: '1', name: 'Project 1' } as any,
          { id: '2', name: 'Project 2' } as any,
        ],
      });
      mockedProjectsApi.archive.mockResolvedValue(undefined as any);

      await useProjectStore.getState().deleteProject('1');

      const projects = useProjectStore.getState().projects;
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('2');
    });

    it('clears currentProject if deleted project is current', async () => {
      useProjectStore.setState({
        projects: [{ id: '1', name: 'Project 1' } as any],
        currentProject: { id: '1', name: 'Project 1' } as any,
      });
      mockedProjectsApi.archive.mockResolvedValue(undefined as any);

      await useProjectStore.getState().deleteProject('1');

      expect(useProjectStore.getState().currentProject).toBeNull();
    });

    it('throws error on failure', async () => {
      useProjectStore.setState({
        projects: [{ id: '1', name: 'Project 1' } as any],
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedProjectsApi.archive.mockRejectedValue(new Error('Delete failed'));

      await expect(
        useProjectStore.getState().deleteProject('1')
      ).rejects.toThrow('Delete failed');
      consoleSpy.mockRestore();
    });
  });

  describe('fetchProject()', () => {
    it('sets currentProject on success', async () => {
      const project = { id: '1', name: 'Project 1', topics: [{ id: 't1' }] };
      mockedProjectsApi.get.mockResolvedValue(project as any);

      await useProjectStore.getState().fetchProject('1');

      expect(useProjectStore.getState().currentProject).toEqual(project);
      expect(useProjectStore.getState().topics).toEqual([{ id: 't1' }]);
      expect(useProjectStore.getState().loading).toBe(false);
    });

    it('handles error when fetching project', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedProjectsApi.get.mockRejectedValue(new Error('Not found'));

      await useProjectStore.getState().fetchProject('bad-id');

      expect(useProjectStore.getState().loading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
