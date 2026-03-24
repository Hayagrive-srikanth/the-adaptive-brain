import React from 'react';
import { render, screen } from '@testing-library/react';
import StreakCounter from '@/components/gamification/StreakCounter';

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Flame: (props: any) => <span data-testid="flame-icon" {...props} />,
  Shield: (props: any) => <span data-testid="shield-icon" {...props} />,
}));

describe('StreakCounter', () => {
  const defaultProps = {
    streakCount: 5,
    streakFreezeAvailable: false,
    atRisk: false,
  };

  it('renders streak count', () => {
    render(<StreakCounter {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('day streak')).toBeInTheDocument();
  });

  it('renders "Keep it going!" for active non-risk streaks', () => {
    render(<StreakCounter {...defaultProps} />);
    expect(screen.getByText('Keep it going!')).toBeInTheDocument();
  });

  it('shows warning message when atRisk is true', () => {
    render(<StreakCounter {...defaultProps} atRisk />);
    expect(screen.getByText('Study today to keep your streak!')).toBeInTheDocument();
  });

  it('applies risk border styling when atRisk is true', () => {
    const { container } = render(<StreakCounter {...defaultProps} atRisk />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-[#FF6B35]');
  });

  it('does not show risk warning when atRisk is false', () => {
    render(<StreakCounter {...defaultProps} />);
    expect(screen.queryByText('Study today to keep your streak!')).not.toBeInTheDocument();
  });

  it('shows streak freeze indicator when streakFreezeAvailable is true', () => {
    render(<StreakCounter {...defaultProps} streakFreezeAvailable />);
    expect(screen.getByText('Freeze')).toBeInTheDocument();
    expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
  });

  it('does not show freeze indicator when streakFreezeAvailable is false', () => {
    render(<StreakCounter {...defaultProps} />);
    expect(screen.queryByText('Freeze')).not.toBeInTheDocument();
  });

  it('renders flame icon', () => {
    render(<StreakCounter {...defaultProps} />);
    expect(screen.getByTestId('flame-icon')).toBeInTheDocument();
  });

  it('renders zero streak count', () => {
    render(<StreakCounter {...defaultProps} streakCount={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
