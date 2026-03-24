import React from 'react';
import { render, screen } from '@testing-library/react';
import ReadinessScore from '@/components/project/ReadinessScore';

describe('ReadinessScore', () => {
  it('renders percentage text', () => {
    render(<ReadinessScore score={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders "Readiness" label', () => {
    render(<ReadinessScore score={50} />);
    expect(screen.getByText('Readiness')).toBeInTheDocument();
  });

  it('clamps score to 0-100 range', () => {
    const { rerender } = render(<ReadinessScore score={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();

    rerender(<ReadinessScore score={-20} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses red color for scores below 30', () => {
    render(<ReadinessScore score={20} />);
    const scoreText = screen.getByText('20%');
    expect(scoreText).toHaveStyle({ color: '#EF4444' });
  });

  it('uses orange color for scores 30-59', () => {
    render(<ReadinessScore score={45} />);
    const scoreText = screen.getByText('45%');
    expect(scoreText).toHaveStyle({ color: '#F97316' });
  });

  it('uses yellow color for scores 60-79', () => {
    render(<ReadinessScore score={70} />);
    const scoreText = screen.getByText('70%');
    expect(scoreText).toHaveStyle({ color: '#EAB308' });
  });

  it('uses green color for scores 80+', () => {
    render(<ReadinessScore score={90} />);
    const scoreText = screen.getByText('90%');
    expect(scoreText).toHaveStyle({ color: '#22C55E' });
  });
});
