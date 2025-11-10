// Назначение: утилита для искусственной паузы перед Telegram-операциями
// Основные модули: отсутствуют

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export default delay;
