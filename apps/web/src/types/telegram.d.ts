/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-require-imports, no-redeclare */
// Назначение файла: объявления интерфейсов Telegram WebApp
// Основные модули: Telegram.WebApp

interface Telegram {
  WebApp?: Telegram.WebApp;
}

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
    Telegram?: Telegram;
  }
}

export {};
