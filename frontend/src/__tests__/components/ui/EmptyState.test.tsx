import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="No items"
        description="Try creating a new item."
      />
    );
    expect(screen.getByText('Try creating a new item.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="No items" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('renders action button with label when actionLabel and onAction are provided', () => {
    const handleAction = jest.fn();
    render(
      <EmptyState
        title="No items"
        actionLabel="Create Item"
        onAction={handleAction}
      />
    );
    expect(screen.getByRole('button', { name: /create item/i })).toBeInTheDocument();
  });

  it('fires onAction when action button is clicked', () => {
    const handleAction = jest.fn();
    render(
      <EmptyState
        title="No items"
        actionLabel="Create Item"
        onAction={handleAction}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /create item/i }));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel is missing', () => {
    render(<EmptyState title="No items" onAction={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when onAction is missing', () => {
    render(<EmptyState title="No items" actionLabel="Create" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders default icon when no icon prop is provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders custom icon when provided', () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-icon">Icon</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
