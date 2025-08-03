// Настройки Babel для тестов
// Модули: @babel/preset-env, @babel/preset-react, @babel/preset-typescript
module.exports = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
};
