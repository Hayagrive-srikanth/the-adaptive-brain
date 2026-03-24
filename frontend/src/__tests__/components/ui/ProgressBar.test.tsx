import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgressBar from '@/components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('renders with correct aria attributes for value', () => {
    render(<ProgressBar value={50} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps value to 0-100 range', () => {
    const { rerender } = render(<ProgressBar value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    rerender(<ProgressBar value={-10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('applies custom color via backgroundColor style', () => {
    const { container } = render(<ProgressBar value={60} color="#FF0000" />);
    const fillBar = container.querySelector('.h-full.rounded-full') as HTMLElement;
    expect(fillBar).toHaveStyle({ backgroundColor: '#FF0000' });
  });

  it('applies default color when color prop is not provided', () => {
    const { container } = render(<ProgressBar value={40} />);
    const fillBar = container.querySelector('.h-full.rounded-full') as HTMLElement;
    expect(fillBar).toHaveStyle({ backgroundColor: '#6C63FF' });
  });

  it('shows percentage label when showLabel is true', () => {
    render(<ProgressBar value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('does not show label when showLabel is false', () => {
    render(<ProgressBar value={75} />);
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('applies custom height via inline style', () => {
    render(<ProgressBar value={50} height={20} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveStyle({ height: '20px' });
  });
});
