#!/usr/bin/env ts-node
// Назначение файла: скрипт установки URL кнопки меню Telegram
// Модули: node-fetch, dotenv
import fetch from 'node-fetch';
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

async function setMenuButton(): Promise<void> {
  const params: MenuButtonRequest = {
    menu_button: {
      type: 'web_app',
      text: 'Открыть приложение',
      web_app: { url }
    }
  };
  if (chatId) params.chat_id = chatId;
  const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data: { ok: boolean; description?: string } = await res.json();
  if (!data.ok) throw new Error(data.description || 'Неизвестная ошибка');
}

setMenuButton()
  .then(() => console.log('Кнопка меню обновлена'))
  .catch(err => {
    console.error('Ошибка:', (err as Error).message);
    process.exit(1);
  });
