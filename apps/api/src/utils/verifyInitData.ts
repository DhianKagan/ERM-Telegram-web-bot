// Назначение файла: проверка подписи initData Telegram WebApp
// Основные модули: @telegram-apps/init-data-node, config
import { parse, validate } from '@telegram-apps/init-data-node';
import config from '../config';

const { botToken } = config;

export default function verifyInitData(initData: string) {
  const token = botToken;
  if (!token) {
    throw new Error('BOT_TOKEN не задан');
  }
  validate(initData, token, { expiresIn: 300 });
  return parse(initData);
}

export type InitData = ReturnType<typeof verifyInitData>;
