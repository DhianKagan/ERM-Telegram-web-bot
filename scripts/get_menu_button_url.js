#!/usr/bin/env node
// Скрипт получения URL кнопки меню Telegram
// Модули: node fetch, dotenv
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN не задан');
  process.exit(1);
}

const chatId = process.env.CHAT_ID;

async function getMenuButton() {
  const params = chatId ? { chat_id: chatId } : {};
  const res = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
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
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
