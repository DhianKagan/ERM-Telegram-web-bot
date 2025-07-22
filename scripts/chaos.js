/* Назначение файла: имитация отказов для chaos testing.
 * Модуль: Node.js
 */
const delay = Math.random() * 60000;
console.log(`Процесс завершится через ${Math.round(delay)} мс`);
setTimeout(() => {
  console.log('Chaos kill');
  process.exit(1);
}, delay);
