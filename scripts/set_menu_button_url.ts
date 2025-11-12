#!/usr/bin/env ts-node
// Назначение файла: скрипт установки URL кнопки меню Telegram
// Модули: глобальный fetch, dotenv
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
const url = process.env.APP_URL;
if (!token) {
  console.error('BOT_TOKEN не задан');
  process.exit(1);
}
if (!url) {
  console.error('APP_URL не задан');
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.error('APP_URL должен начинаться с https://');
  process.exit(1);
}

const chatId = process.env.CHAT_ID;

interface MenuButtonRequest {
  menu_button: {
    type: 'web_app';
    text: string;
    web_app: { url: string };
  };
  chat_id?: string;
}

function ensureFetch(): typeof globalThis.fetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Глобальная функция fetch недоступна');
  }
  return globalThis.fetch;
}

async function setMenuButton(): Promise<void> {
  const fetchFn = ensureFetch();
  const params: MenuButtonRequest = {
    menu_button: {
      type: 'web_app',
      text: 'Открыть приложение',
      web_app: { url },
    },
  };
  if (chatId) params.chat_id = chatId;
  const res = await fetchFn(
    `https://api.telegram.org/bot${token}/setChatMenuButton`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    },
  );
  const data: { ok: boolean; description?: string } = await res.json();
  if (!data.ok) throw new Error(data.description || 'Неизвестная ошибка');
}

setMenuButton()
  .then(() => console.log('Кнопка меню обновлена'))
  .catch((err) => {
    console.error('Ошибка:', (err as Error).message);
    process.exit(1);
  });
