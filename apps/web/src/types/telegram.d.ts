// Назначение файла: объявления интерфейсов Telegram WebApp
// Основные модули: Telegram.WebApp

/* eslint-disable no-redeclare */
interface Telegram {
  WebApp?: Telegram.WebApp;
}

declare namespace Telegram {
  interface WebApp {
    initData: string;
    initDataUnsafe: Record<string, unknown>;
    sendData(data: string): void;
    translate?(key: string): string;
  }
}
/* eslint-enable no-redeclare */

declare global {
  interface Window {
    Telegram?: Telegram;
  }
}

export {};
