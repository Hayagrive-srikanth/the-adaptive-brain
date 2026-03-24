import React from 'react';
import { render, screen } from '@testing-library/react';
import { Spinner, SkeletonLoader } from '@/components/ui/Loader';

function getSvgClasses(container: HTMLElement): string {
  const svg = container.querySelector('svg');
  // SVG className is an SVGAnimatedString, not a regular string
  return svg?.getAttribute('class') || (svg?.className as any)?.baseVal || '';
}

describe('Spinner', () => {
  it('renders with role="status"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible label "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('applies correct size class for sm', () => {
    const { container } = render(<Spinner size="sm" />);
    const classes = getSvgClasses(container);
    expect(classes).toContain('h-5');
    expect(classes).toContain('w-5');
  });

  it('applies correct size class for md (default)', () => {
    const { container } = render(<Spinner />);
    const classes = getSvgClasses(container);
    expect(classes).toContain('h-8');
    expect(classes).toContain('w-8');
  });

  it('applies correct size class for lg', () => {
    const { container } = render(<Spinner size="lg" />);
    const classes = getSvgClasses(container);
    expect(classes).toContain('h-12');
    expect(classes).toContain('w-12');
  });

  it('has animate-spin class', () => {
    const { container } = render(<Spinner />);
    const classes = getSvgClasses(container);
    expect(classes).toContain('animate-spin');
  });
});

describe('SkeletonLoader', () => {
  it('renders with role="status"', () => {
    render(<SkeletonLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders default 3 skeleton lines', () => {
    const { container } = render(<SkeletonLoader />);
    const lines = container.querySelectorAll('.h-4');
    expect(lines).toHaveLength(3);
  });

  it('renders specified number of lines', () => {
    const { container } = render(<SkeletonLoader lines={5} />);
    const lines = container.querySelectorAll('.h-4');
    expect(lines).toHaveLength(5);
  });

  it('renders circle placeholder when circle is true', () => {
    const { container } = render(<SkeletonLoader circle />);
    const circle = container.querySelector('.rounded-full');
    expect(circle).not.toBeNull();
  });

  it('does not render circle placeholder by default', () => {
    const { container } = render(<SkeletonLoader />);
    const circle = container.querySelector('.rounded-full');
    expect(circle).toBeNull();
  });

  it('sets last line width to 60%', () => {
    const { container } = render(<SkeletonLoader lines={3} />);
    const lines = container.querySelectorAll('.h-4');
    const lastLine = lines[lines.length - 1] as HTMLElement;
    expect(lastLine.style.width).toBe('60%');
  });
});
