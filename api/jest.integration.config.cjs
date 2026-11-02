module.exports = {
  displayName: 'api:integration',
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 15000,
};
