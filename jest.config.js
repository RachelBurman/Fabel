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
    // Specific mocks must come before the catch-all @/ alias
    '^next-intl/server$': '<rootDir>/__mocks__/next-intl.js',
    '^next-intl/(.*)$': '<rootDir>/__mocks__/next-intl.js',
    '^next-intl$': '<rootDir>/__mocks__/next-intl.js',
    '^@/lib/auth$': '<rootDir>/__mocks__/lib/auth.js',
    '^next/headers$': '<rootDir>/__mocks__/next/headers.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '\\.claude'],
  modulePathIgnorePatterns: ['\\.claude'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

module.exports = config
