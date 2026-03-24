const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
const customConfig = {
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react)/)',
  ],
};
module.exports = createJestConfig(customConfig);
