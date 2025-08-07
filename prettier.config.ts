/**
 * Назначение файла: конфигурация Prettier для сервера и клиента.
 */
import type { Options } from 'prettier';

const config: Options = {
  singleQuote: true,
  trailingComma: 'all',
};

export default config;
module.exports = config;
