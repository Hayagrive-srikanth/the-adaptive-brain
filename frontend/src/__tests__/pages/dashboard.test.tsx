import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock all stores before importing the component
const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@test.com' };
const mockProjects: any[] = [];
let mockLoading = false;
const mockFetchProjects = jest.fn();
const mockDeleteProject = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: any) => {
    const state = { user: mockUser, loading: false, initialize: jest.fn() };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/projectStore', () => ({
  useProjectStore: (selector?: any) => {
    const state = {
      projects: mockProjects,
      loading: mockLoading,
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/gamificationStore', () => ({
  useGamificationStore: (selector?: any) => {
    const state = { xp: 500, streak: 3 };
    return selector ? selector(state) : state;
  },
}));

// Mock AuthGuard to pass through
jest.mock('@/components/auth/AuthGuard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock lucide-react
jest.mock('lucide-react', () => new Proxy({}, {
  get: (_target: any, prop: string) => {
    const React = require('react');
    return React.forwardRef((props: any, ref: any) =>
      React.createElement('span', { ...props, ref, 'data-testid': `icon-${prop}` })
    );
  },
}));

import DashboardPage from '@/app/dashboard/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockProjects.length = 0;
  mockLoading = false;
});

describe('DashboardPage', () => {
  it('renders greeting with user name', () => {
    render(<DashboardPage />);
    // The greeting depends on time of day, so just check for the name
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('renders project cards when projects exist', () => {
    mockProjects.push(
      {
        id: 'p1',
        name: 'Math Exam',
        examDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        exam_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        readinessScore: 50,
        readiness_score: 50,
        status: 'active',
      },
      {
        id: 'p2',
        name: 'History Exam',
        examDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        exam_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        readinessScore: 30,
        readiness_score: 30,
        status: 'active',
      }
    );

    render(<DashboardPage />);
    // "Math Exam" appears in both TodaysPriority and ProjectCard
    expect(screen.getAllByText('Math Exam').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('History Exam').length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when no projects exist', () => {
    render(<DashboardPage />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('renders "Create New Project" button that links to /project/new', () => {
    render(<DashboardPage />);
    const createLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/project/new'
    );
    expect(createLink).toBeTruthy();
  });

  it('renders XP display', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/500 XP/)).toBeInTheDocument();
  });

  it('renders streak display', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/3 day streak/)).toBeInTheDocument();
  });
});
