import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectCard from '@/components/dashboard/ProjectCard';
import type { Project } from '@/types';

// Mock the project store
const mockDeleteProject = jest.fn();
jest.mock('@/stores/projectStore', () => ({
  useProjectStore: (selector: any) => selector({ deleteProject: mockDeleteProject }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Calendar: (props: any) => <span data-testid="calendar-icon" {...props} />,
  CheckCircle: (props: any) => <span data-testid="check-circle-icon" {...props} />,
  Trash2: (props: any) => <span data-testid="trash-icon" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
}));

function createProject(overrides: Partial<Record<string, any>> = {}): any {
  return {
    id: 'proj-1',
    name: 'Test Exam',
    examDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    readinessScore: 65,
    status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProjectCard', () => {
  it('renders project name', () => {
    render(<ProjectCard project={createProject()} />);
    expect(screen.getByText('Test Exam')).toBeInTheDocument();
  });

  it('renders exam date', () => {
    const project = createProject({ examDate: '2026-06-15' });
    render(<ProjectCard project={project} />);
    // Date may render as Jun 14 or Jun 15 depending on timezone
    expect(screen.getByText(/Jun 1[45], 2026/)).toBeInTheDocument();
  });

  it('renders days remaining badge', () => {
    render(<ProjectCard project={createProject()} />);
    // Should show something like "7 days left"
    expect(screen.getByText(/days? left/)).toBeInTheDocument();
  });

  it('shows "Past due" for past exam dates', () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    render(<ProjectCard project={createProject({ examDate: pastDate })} />);
    expect(screen.getByText('Past due')).toBeInTheDocument();
  });

  it('renders readiness progress bar', () => {
    render(<ProjectCard project={createProject({ readinessScore: 65 })} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Readiness')).toBeInTheDocument();
  });

  it('shows delete confirmation overlay when delete button is clicked', () => {
    render(<ProjectCard project={createProject()} />);

    const deleteBtn = screen.getByTitle('Delete project');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete this project?')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls deleteProject when delete is confirmed', async () => {
    mockDeleteProject.mockResolvedValue(undefined);
    render(<ProjectCard project={createProject()} />);

    // Click delete button
    fireEvent.click(screen.getByTitle('Delete project'));

    // Click confirm delete
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('proj-1');
    });
  });

  it('dismisses confirmation when Cancel is clicked', () => {
    render(<ProjectCard project={createProject()} />);

    // Click delete button
    fireEvent.click(screen.getByTitle('Delete project'));
    expect(screen.getByText('Delete this project?')).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Delete this project?')).not.toBeInTheDocument();
  });
});
