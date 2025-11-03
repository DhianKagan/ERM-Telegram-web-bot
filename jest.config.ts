/**
 * Назначение файла: конфигурация Jest для TypeScript тестов.
 * Основные модули: ts-jest.
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/apps/web/src', '<rootDir>/apps/api/tests'],
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
    '^pmtiles$': '<rootDir>/tests/stubs/pmtiles.ts',
    '^maplibre-gl$': '<rootDir>/tests/stubs/maplibre-gl.ts',
    '^maplibre-gl-draw$': '@mapbox/mapbox-gl-draw',
  },
  setupFiles: [
    '<rootDir>/tests/setupMongoMemoryServer.ts',
    '<rootDir>/tests/setupEnv.ts',
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      { tsconfig: './tests/tsconfig.json', diagnostics: false },
    ],
  },
};

export default config;
