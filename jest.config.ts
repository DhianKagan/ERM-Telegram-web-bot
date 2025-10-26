/**
 * Назначение файла: конфигурация Jest для TypeScript тестов.
 * Основные модули: ts-jest.
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/apps/web/src'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/api/',
    '<rootDir>/tests/playwright/',
    '<rootDir>/apps/web/src/types/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^shared$': '<rootDir>/packages/shared/src',
    '^shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@dnd-kit/core$': '<rootDir>/tests/stubs/dndKitCore.tsx',
    '^@dnd-kit/sortable$': '<rootDir>/tests/stubs/dndKitSortable.tsx',
    '^@dnd-kit/utilities$': '<rootDir>/tests/stubs/dndKitUtilities.ts',
  },
  setupFiles: [
    '<rootDir>/tests/setupMongoMemoryServer.ts',
    '<rootDir>/tests/setupEnv.ts',
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: './tests/tsconfig.json' }],
  },
};

export default config;
