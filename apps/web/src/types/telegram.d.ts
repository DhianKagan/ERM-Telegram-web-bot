// Назначение файла: объявления интерфейсов Telegram WebApp
// Основные модули: Telegram.WebApp

type TelegramGlobal = {
  WebApp?: Telegram.WebApp;
};

declare namespace Telegram {
  interface WebApp {
    initData: string;
    initDataUnsafe: Record<string, unknown>;
    sendData(data: string): void;
    close(): void;
    translate?(key: string): string;
  }
}

declare global {
  interface Window {
    Telegram?: TelegramGlobal;
  }
}

export {};
