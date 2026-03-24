import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuizInterface from '@/components/session/QuizInterface';
import type { QuizQuestion } from '@/types';

// Mock stores and API
const mockSubmitAnswer = jest.fn();
jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: (selector: any) => selector({ submitAnswer: mockSubmitAnswer }),
}));

jest.mock('@/lib/api', () => ({
  quizApi: {
    hint: jest.fn(),
    rephrase: jest.fn(),
  },
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  CheckCircle: (props: any) => <span data-testid="check-circle" {...props} />,
  XCircle: (props: any) => <span data-testid="x-circle" {...props} />,
  Lightbulb: (props: any) => <span data-testid="lightbulb" {...props} />,
  ArrowRight: (props: any) => <span data-testid="arrow-right" {...props} />,
  RefreshCw: (props: any) => <span data-testid="refresh" {...props} />,
}));

function createQuestion(overrides: Partial<Record<string, any>> = {}): any {
  return {
    id: 'q1',
    topic_id: 't1',
    question_type: 'multiple_choice',
    question_text: 'What is 2 + 2?',
    options: ['Three', 'Four', 'Five', 'Six'],
    difficulty: 'easy',
    hints: [],
    times_shown: 0,
    times_correct: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('QuizInterface', () => {
  const defaultProps = {
    sessionId: 's1',
    onComplete: jest.fn(),
  };

  it('renders question text', () => {
    const questions = [createQuestion()];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  });

  it('renders MCQ options', () => {
    const questions = [
      createQuestion({
        options: ['Three', 'Four', 'Five', 'Six'],
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.getByText('Four')).toBeInTheDocument();
  });

  it('renders question progress indicator', () => {
    const questions = [createQuestion(), createQuestion({ id: 'q2', question_text: 'Q2' })];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
  });

  it('shows Submit Answer button', () => {
    const questions = [createQuestion()];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByText('Submit Answer')).toBeInTheDocument();
  });

  it('disables Submit Answer button when no answer is selected', () => {
    const questions = [createQuestion()];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    const submitBtn = screen.getByText('Submit Answer').closest('button');
    expect(submitBtn).toBeDisabled();
  });

  it('shows feedback after submitting correct answer', async () => {
    mockSubmitAnswer.mockResolvedValue({
      is_correct: true,
      correct_answer: 'Four',
      explanation: 'Well done!',
    });

    const questions = [
      createQuestion({
        options: ['Three', 'Four'],
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);

    // Select an option
    fireEvent.click(screen.getByText('Four'));

    // Submit
    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => {
      expect(screen.getByText('Correct!')).toBeInTheDocument();
    });
  });

  it('shows feedback after submitting incorrect answer', async () => {
    mockSubmitAnswer.mockResolvedValue({
      is_correct: false,
      correct_answer: 'Four',
      explanation: 'The correct answer is Four.',
    });

    const questions = [
      createQuestion({
        options: ['Three', 'Four'],
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);

    fireEvent.click(screen.getByText('Three'));
    fireEvent.click(screen.getByText('Submit Answer'));

    await waitFor(() => {
      expect(screen.getByText('Not quite')).toBeInTheDocument();
    });
  });

  it('renders true/false options for true_false questions', () => {
    const questions = [
      createQuestion({
        question_type: 'true_false',
        question_text: 'The sky is blue.',
        options: null,
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByText('True')).toBeInTheDocument();
    expect(screen.getByText('False')).toBeInTheDocument();
  });

  it('renders fill-in-the-blank input for fill_blank questions', () => {
    const questions = [
      createQuestion({
        question_type: 'fill_blank',
        question_text: 'The capital of France is ____.',
        options: null,
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
  });

  it('shows hint button when hints are available', () => {
    const questions = [
      createQuestion({
        hints: ['First hint', 'Second hint'],
      }),
    ];
    render(<QuizInterface questions={questions} {...defaultProps} />);
    expect(screen.getAllByText(/hint/i).length).toBeGreaterThanOrEqual(1);
  });
});
