module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  restoreMocks: true,
  // The first native render lazily transforms React Native internals. Keep a
  // bounded cold-cache budget without changing assertions or request retries.
  testTimeout: 15000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx', '<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
