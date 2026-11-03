import { fileURLToPath, URL } from 'node:url';
import nextJest from 'next/jest.js';

const appDirectory = fileURLToPath(new URL('.', import.meta.url));
const createJestConfig = nextJest({ dir: appDirectory });

export default createJestConfig({
  rootDir: appDirectory,
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost:3000' },
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  clearMocks: true,
  restoreMocks: true,
  coverageProvider: 'v8',
});
