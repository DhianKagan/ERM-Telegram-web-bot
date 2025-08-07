// Назначение файла: проверка подписи initData Telegram WebApp
// Основные модули: crypto, config
import crypto from 'crypto';
import config from '../config';

const { botToken } = config;

export default function verifyInitData(initData: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const token = botToken;
  if (!token) {
    throw new Error('BOT_TOKEN не задан');
  }
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  return hmac === hash;
}
