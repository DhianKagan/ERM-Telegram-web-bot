import { themeConfig } from '../src/themes/custom-theme/index.js'
if (themeConfig.id !== 'custom-theme') {
  throw new Error('Неверный id темы')
}
console.log('Тест пройден')
