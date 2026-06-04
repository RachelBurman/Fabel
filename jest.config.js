/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
          resolveJsonModule: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Provide a no-session default so API route tests that don't mock Clerk
    // still work — getUserId() falls back to the guestId from the request.
    '^@clerk/nextjs/server$': '<rootDir>/__mocks__/@clerk/nextjs/server.js',
    '^@clerk/nextjs$': '<rootDir>/__mocks__/@clerk/nextjs/index.js',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

module.exports = config
