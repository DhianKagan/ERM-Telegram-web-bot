/**
 * Назначение файла: конфигурация Jest для клиентских тестов веб-интерфейса.
 * Основные модули: ts-jest, jsdom.
 */
import * as path from 'path';
import type { Config } from 'jest';
import base from '../jest.config';

const config: Config = {
  ...base,
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/apps/web/src'],
  setupFiles: ['<rootDir>/tests/setupNodeEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupJestDom.ts'],
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^shared$': '<rootDir>/packages/shared/src',
    '^shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^maplibre-gl$': 'maplibre-gl',
    '^maplibre-gl-draw$': 'maplibre-gl-draw',
    '\\.(css|less|scss)$': '<rootDir>/tests/styleMock.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/apps/web/src/types/'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tests/tsconfig.json', diagnostics: false },
    ],
  },
};

export default config;
