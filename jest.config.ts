/**
 * Назначение файла: конфигурация Jest для TypeScript тестов.
 * Основные модули: ts-jest.
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/', '<rootDir>/tests/api/'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.[jt]sx?$': ['ts-jest', { tsconfig: './tests/tsconfig.json' }],
  },
};

export default config;
