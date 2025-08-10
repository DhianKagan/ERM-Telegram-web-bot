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
  coverageDirectory: 'coverage',
};

export default config;
