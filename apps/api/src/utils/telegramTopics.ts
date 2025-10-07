// Назначение файла: парсинг ссылок на темы Telegram.
// Основные модули: URL.

const TELEGRAM_DOMAINS = new Set([
  't.me',
  'telegram.me',
  'telegram.dog',
]);

const TOPIC_PATH_REGEXP = /^\/c\/(\d{1,20})\/(\d{1,20})(?:\/?|$)/;

export interface TelegramTopicInfo {
  chatId: string;
  topicId: number;
}

const ensureUrl = (raw: string): URL | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const hasProtocol = /^[a-z][a-z0-9+.-]*:/.test(trimmed);
  const candidate = hasProtocol ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
};

export const parseTelegramTopicUrl = (
  raw: unknown,
): TelegramTopicInfo | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const url = ensureUrl(raw);
  if (!url) {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (!TELEGRAM_DOMAINS.has(hostname)) {
    return null;
  }
  const match = TOPIC_PATH_REGEXP.exec(url.pathname);
  if (!match) {
    return null;
  }
  const [, chatComponent, topicComponent] = match;
  const topicId = Number(topicComponent);
  if (!Number.isFinite(topicId)) {
    return null;
  }
  const chatId = `-100${chatComponent}`;
  if (!/^(-?\d{5,})$/.test(chatId)) {
    return null;
  }
  return { chatId, topicId };
};

export default { parseTelegramTopicUrl };
