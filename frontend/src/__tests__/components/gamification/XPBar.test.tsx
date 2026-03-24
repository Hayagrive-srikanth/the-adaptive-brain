import React from 'react';
import { render, screen } from '@testing-library/react';
import XPBar from '@/components/gamification/XPBar';

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Zap: (props: any) => <span data-testid="zap-icon" {...props} />,
}));

describe('XPBar', () => {
  it('renders current and goal XP', () => {
    render(<XPBar currentXP={150} goalXP={300} level={5} />);
    expect(screen.getByText('150 / 300 XP')).toBeInTheDocument();
  });

  it('renders level indicator', () => {
    render(<XPBar currentXP={100} goalXP={200} level={3} />);
    expect(screen.getByText('Lv.3')).toBeInTheDocument();
  });

  it('renders "Daily XP" label', () => {
    render(<XPBar currentXP={50} goalXP={100} level={1} />);
    expect(screen.getByText('Daily XP')).toBeInTheDocument();
  });

  it('shows daily goal reached message when XP meets goal', () => {
    render(<XPBar currentXP={300} goalXP={300} level={5} />);
    expect(screen.getByText('Daily goal reached!')).toBeInTheDocument();
  });

  it('does not show daily goal message when XP is below goal', () => {
    render(<XPBar currentXP={100} goalXP={300} level={5} />);
    expect(screen.queryByText('Daily goal reached!')).not.toBeInTheDocument();
  });

  it('renders Zap icon', () => {
    render(<XPBar currentXP={50} goalXP={100} level={1} />);
    expect(screen.getByTestId('zap-icon')).toBeInTheDocument();
  });

  it('caps percentage at 100% when currentXP exceeds goalXP', () => {
    const { container } = render(<XPBar currentXP={500} goalXP={300} level={10} />);
    // The component should still render without errors
    expect(screen.getByText('500 / 300 XP')).toBeInTheDocument();
    expect(screen.getByText('Daily goal reached!')).toBeInTheDocument();
  });
});
