import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/ui/Button';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  describe('variants', () => {
    it('applies primary variant classes by default', () => {
      render(<Button>Primary</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('bg-[#6C63FF]');
      expect(btn.className).toContain('text-white');
    });

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('border');
      expect(btn.className).toContain('text-[#6C63FF]');
    });

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('bg-transparent');
      expect(btn.className).toContain('text-gray-700');
    });
  });

  describe('sizes', () => {
    it('applies sm size classes', () => {
      render(<Button size="sm">Small</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('px-3');
      expect(btn.className).toContain('py-1.5');
      expect(btn.className).toContain('text-sm');
    });

    it('applies md size classes by default', () => {
      render(<Button>Medium</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('px-5');
      expect(btn.className).toContain('py-2.5');
      expect(btn.className).toContain('text-base');
    });

    it('applies lg size classes', () => {
      render(<Button size="lg">Large</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('px-7');
      expect(btn.className).toContain('py-3.5');
      expect(btn.className).toContain('text-lg');
    });
  });

  it('shows spinner and disables button when loading', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner is an SVG with animate-spin class
    const svg = btn.querySelector('svg.animate-spin');
    expect(svg).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
