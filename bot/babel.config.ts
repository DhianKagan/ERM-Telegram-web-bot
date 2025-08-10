/**
 * Настройки Babel для тестов
 * Модули: @babel/preset-env, @babel/preset-react, @babel/preset-typescript
 */
import type { TransformOptions } from '@babel/core';

const config: TransformOptions = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    'babel-plugin-transform-typescript-metadata',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
  ],
};

export default config;
module.exports = config;
