import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPrefetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    prefetch: mockPrefetch,
    pathname: '/',
    query: {},
  }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Mock next/link — render a plain anchor so tests can query by role="link"
// ---------------------------------------------------------------------------
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ children, href, ...rest }: any) =>
      React.createElement('a', { href, ...rest }, children),
  };
});

// ---------------------------------------------------------------------------
// Mock framer-motion — pass-through that renders plain HTML elements
// ---------------------------------------------------------------------------
jest.mock('framer-motion', () => {
  const React = require('react');

  const motion = new Proxy(
    {},
    {
      get: (_target: any, prop: string) => {
        return React.forwardRef((props: any, ref: any) => {
          const {
            initial,
            animate,
            exit,
            transition,
            variants,
            whileHover,
            whileTap,
            whileInView,
            whileFocus,
            whileDrag,
            layout,
            layoutId,
            onAnimationStart,
            onAnimationComplete,
            ...rest
          } = props;
          return React.createElement(prop, { ...rest, ref });
        });
      },
    }
  );

  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useMotionValue: (initial: number) => ({ get: () => initial, set: jest.fn() }),
    useTransform: () => ({ get: () => 0, set: jest.fn() }),
    useSpring: () => ({ get: () => 0, set: jest.fn() }),
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/supabase
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null }),
      }),
    }),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
});

// ---------------------------------------------------------------------------
// Export mocks for direct use in tests
// ---------------------------------------------------------------------------
export { mockPush, mockReplace, mockBack, mockPrefetch, mockSupabase };
