module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx', '<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
