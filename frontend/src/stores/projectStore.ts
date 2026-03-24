import { create } from 'zustand';
import { projectsApi, materialsApi, topicsApi, plansApi } from '@/lib/api';
import type { Project, SourceMaterial, Topic, StudyPlan } from '@/types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  materials: SourceMaterial[];
  topics: Topic[];
  studyPlan: StudyPlan | null;
  loading: boolean;
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; exam_date: string; hours_per_day: number; comfort_level: string }) => Promise<Project>;
  fetchProject: (id: string) => Promise<void>;
  uploadMaterial: (projectId: string, files: File[]) => Promise<void>;
  fetchMaterials: (projectId: string) => Promise<void>;
  fetchTopics: (projectId: string) => Promise<void>;
  generateTopics: (projectId: string) => Promise<void>;
  fetchPlan: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  materials: [],
  topics: [],
  studyPlan: null,
  loading: false,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const data = await projectsApi.list();
      set({ projects: data.projects });
    } catch (error) {
      console.error('Fetch projects error:', error);
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (data) => {
    set({ loading: true });
    try {
      const project = await projectsApi.create(data) as Project;
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } finally {
      set({ loading: false });
    }
  },

  fetchProject: async (id: string) => {
    set({ loading: true });
    try {
      const project = await projectsApi.get(id) as Project;
      set({ currentProject: project, topics: project.topics || [] });
    } catch (error) {
      console.error('Fetch project error:', error);
    } finally {
      set({ loading: false });
    }
  },

  uploadMaterial: async (projectId, files) => {
    set({ loading: true });
    try {
      await materialsApi.upload(projectId, files);
      // Refresh materials list
      const data = await materialsApi.list(projectId);
      set({ materials: data.materials });
    } finally {
      set({ loading: false });
    }
  },

  fetchMaterials: async (projectId) => {
    try {
      const data = await materialsApi.list(projectId);
      set({ materials: data.materials });
    } catch (error) {
      console.error('Fetch materials error:', error);
    }
  },

  fetchTopics: async (projectId) => {
    try {
      const data = await topicsApi.list(projectId);
      set({ topics: data.topics });
    } catch (error) {
      console.error('Fetch topics error:', error);
    }
  },

  generateTopics: async (projectId) => {
    try {
      await topicsApi.generate(projectId);
    } catch (error) {
      console.error('Generate topics error:', error);
    }
  },

  fetchPlan: async (projectId) => {
    try {
      const plan = await plansApi.get(projectId) as StudyPlan;
      set({ studyPlan: plan });
    } catch (error) {
      console.error('Fetch plan error:', error);
    }
  },

  deleteProject: async (projectId) => {
    try {
      await projectsApi.archive(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
      }));
    } catch (error) {
      console.error('Delete project error:', error);
      throw error;
    }
  },
}));
