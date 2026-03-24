import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Card from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      const { container } = render(<Card>Default</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-white');
      expect(card.className).toContain('shadow-sm');
      expect(card.className).toContain('border-gray-100');
    });

    it('applies highlighted variant styles', () => {
      const { container } = render(<Card variant="highlighted">Highlighted</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-2');
      expect(card.className).toContain('border-[#6C63FF]');
    });

    it('applies interactive variant styles', () => {
      const { container } = render(<Card variant="interactive">Interactive</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
      expect(card.className).toContain('hover:shadow-md');
    });
  });

  it('sets role="button" and tabIndex when onClick is provided', () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Clickable</Card>);
    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('does not set role="button" when onClick is not provided', () => {
    render(<Card>Static</Card>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Click me</Card>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Enter key press', () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Press Enter</Card>);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Space key press', () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Press Space</Card>);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
