import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

// Mock the auth store
const mockSignIn = jest.fn();
const mockSignInWithGoogle = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle,
    loading: false,
  }),
}));

// Mock lucide-react (not used in login but may be pulled transitively)
jest.mock('lucide-react', () => new Proxy({}, {
  get: (_target: any, prop: string) => (props: any) => <span data-testid={`icon-${prop}`} {...props} />,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders email input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('renders password input', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders Sign In button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders link to signup page', () => {
    render(<LoginPage />);
    const signupLink = screen.getByRole('link', { name: /sign up/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute('href', '/signup');
  });

  it('renders app title', () => {
    render(<LoginPage />);
    expect(screen.getByText('The Adaptive Brain')).toBeInTheDocument();
  });

  it('calls signIn with email and password on form submission', async () => {
    mockSignIn.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'mypassword' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'mypassword');
    });
  });

  it('shows error message when signIn fails', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'bad@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    });

    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('renders Google sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
  });
});
