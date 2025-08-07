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
};

export default config;
module.exports = config;
