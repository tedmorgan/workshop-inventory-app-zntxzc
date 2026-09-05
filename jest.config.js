module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)', '**/?(*.)+(spec|test).(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@integrations/(.*)$': '<rootDir>/app/integrations/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      // Disable type checking during tests
      isolatedModules: true,
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowJs: true,
        moduleResolution: 'node',
        skipLibCheck: true,
        noImplicitAny: false,
        // Pin rootDir/outDir so newer TypeScript (SDK 57) doesn't error with
        // TS5011 when a single nested test file is compiled in isolation.
        rootDir: '.',
        outDir: undefined,
        composite: false,
        declaration: false,
      },
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};
