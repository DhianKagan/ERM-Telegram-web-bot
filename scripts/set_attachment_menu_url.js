#!/usr/bin/env node
// Скрипт установки URL для Attachment Menu Telegram
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
const base = process.env.APP_URL;

if (!token) {
  console.error('BOT_TOKEN не задан');
  process.exit(1);
}
if (!base) {
  console.error('APP_URL не задан');
  process.exit(1);
}
if (!base.startsWith('https://')) {
  console.error('APP_URL должен начинаться с https://');
  process.exit(1);
}

const url = `${base.replace(/\/$/, '')}/menu`;
const chatId = process.env.CHAT_ID;

async function updateMenu() {
  const params = {
    menu_button: {
      type: 'web_app',
      text: 'Мои задачи',
      web_app: { url }
    }
  };
  if (chatId) params.chat_id = chatId;
  const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
}

updateMenu()
  .then(() => console.log('Attachment Menu обновлено'))
  .catch(err => {
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
