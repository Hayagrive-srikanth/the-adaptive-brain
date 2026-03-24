import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StudyPath from '@/components/project/StudyPath';
import type { Topic } from '@/types';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Lock: (props: any) => <span data-testid="lock-icon" {...props} />,
  Check: (props: any) => <span data-testid="check-icon" {...props} />,
  BookOpen: (props: any) => <span data-testid="book-icon" {...props} />,
}));

function createTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    project_id: 'proj-1',
    name: 'Topic 1',
    description: null,
    difficulty: 'foundational',
    prerequisite_ids: [],
    mastery_percentage: 0,
    status: 'not_started',
    estimated_minutes: 30,
    path_order: 0,
    source_material_ids: [],
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

describe('StudyPath', () => {
  it('renders correct number of topic nodes', () => {
    const topics = [
      createTopic({ id: 't1', name: 'Intro', path_order: 0 }),
      createTopic({ id: 't2', name: 'Basics', path_order: 1 }),
      createTopic({ id: 't3', name: 'Advanced', path_order: 2 }),
    ];
    const onSelect = jest.fn();
    render(<StudyPath topics={topics} onSelectTopic={onSelect} />);

    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Basics')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('shows check icon for mastered topics', () => {
    const topics = [
      createTopic({ id: 't1', name: 'Done', status: 'mastered', path_order: 0 }),
    ];
    render(<StudyPath topics={topics} onSelectTopic={jest.fn()} />);
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('shows lock icon for locked topics (prerequisites not met)', () => {
    const topics = [
      createTopic({ id: 't1', name: 'First', status: 'not_started', path_order: 0 }),
      createTopic({
        id: 't2',
        name: 'Second',
        status: 'not_started',
        prerequisite_ids: ['t1'],
        path_order: 1,
      }),
    ];
    render(<StudyPath topics={topics} onSelectTopic={jest.fn()} />);
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
  });

  it('makes available topics clickable', () => {
    const onSelect = jest.fn();
    const topics = [
      createTopic({ id: 't1', name: 'Available', status: 'not_started', path_order: 0 }),
    ];
    render(<StudyPath topics={topics} onSelectTopic={onSelect} />);

    const button = screen.getByLabelText('Available - available');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('does not fire onSelectTopic for locked topics', () => {
    const onSelect = jest.fn();
    const topics = [
      createTopic({ id: 't1', name: 'First', status: 'not_started', path_order: 0 }),
      createTopic({
        id: 't2',
        name: 'Locked',
        status: 'not_started',
        prerequisite_ids: ['t1'],
        path_order: 1,
      }),
    ];
    render(<StudyPath topics={topics} onSelectTopic={onSelect} />);

    const lockedButton = screen.getByLabelText('Locked - locked');
    fireEvent.click(lockedButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('handles null prerequisite_ids gracefully', () => {
    const topics = [
      createTopic({
        id: 't1',
        name: 'No Prereqs',
        status: 'not_started',
        prerequisite_ids: undefined as any,
        path_order: 0,
      }),
    ];
    // Should not throw
    expect(() => {
      render(<StudyPath topics={topics} onSelectTopic={jest.fn()} />);
    }).not.toThrow();
  });

  it('shows book icon for available and in_progress topics', () => {
    const topics = [
      createTopic({ id: 't1', name: 'In Progress', status: 'in_progress', path_order: 0 }),
    ];
    render(<StudyPath topics={topics} onSelectTopic={jest.fn()} />);
    expect(screen.getByTestId('book-icon')).toBeInTheDocument();
  });
});
