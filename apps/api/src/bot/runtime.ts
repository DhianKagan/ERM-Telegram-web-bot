// Назначение файла: точка входа для процесса Telegram-бота.
// Основные модули: bot, scheduler, keyRotation
import { startBot } from './bot';
import { startScheduler } from '../services/scheduler';
import { startKeyRotation } from '../services/keyRotation';

if (process.env.NODE_ENV !== 'test') {
  startBot()
    .then(() => {
      startScheduler();
      startKeyRotation();
    })
    .catch((error) => {
      console.error('Критическая ошибка запуска процесса бота', error);
      process.exit(1);
    });
}
