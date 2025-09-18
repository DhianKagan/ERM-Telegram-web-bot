#!/usr/bin/env ts-node
// Назначение файла: скрипт получения URL кнопки меню Telegram
// Модули: глобальный fetch, dotenv
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN не задан');
  process.exit(1);
}

const chatId = process.env.CHAT_ID;

interface WebApp {
  url: string;
}

interface MenuButton {
  type: string;
  web_app?: WebApp;
}

function ensureFetch(): typeof globalThis.fetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Глобальная функция fetch недоступна');
  }
  return globalThis.fetch;
}

async function getMenuButton(): Promise<MenuButton> {
  const fetchFn = ensureFetch();
  const params = chatId ? { chat_id: chatId } : {};
  const res = await fetchFn(`https://api.telegram.org/bot${token}/getChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data: { ok: boolean; result: MenuButton; description?: string } = await res.json();
  if (!data.ok) throw new Error(data.description || 'Неизвестная ошибка');
  return data.result;
}

getMenuButton()
  .then(btn => {
    if (btn.type === 'web_app' && btn.web_app) {
      console.log(btn.web_app.url);
    } else if (btn.type === 'commands' || btn.type === 'default') {
      console.log('/empty');
    } else {
      console.log('unknown');
    }
  })
  .catch(err => {
    console.error('Ошибка:', (err as Error).message);
    process.exit(1);
  });
