// Назначение файла: проверка парсинга ссылок на темы Telegram.
// Основные модули: parseTelegramTopicUrl.

import { parseTelegramTopicUrl } from '../src/utils/telegramTopics';

describe('parseTelegramTopicUrl', () => {
  it('возвращает идентификаторы для корректной ссылки', () => {
    const result = parseTelegramTopicUrl('https://t.me/c/2705661520/627');
    expect(result).toEqual({ chatId: '-1002705661520', topicId: 627 });
  });

  it('игнорирует неизвестные домены', () => {
    expect(parseTelegramTopicUrl('https://example.com/c/1/2')).toBeNull();
  });

  it('обрабатывает ссылки без протокола', () => {
    const result = parseTelegramTopicUrl('t.me/c/123/456');
    expect(result).toEqual({ chatId: '-100123', topicId: 456 });
  });

  it('возвращает null для некорректного формата', () => {
    expect(parseTelegramTopicUrl('https://t.me/example')).toBeNull();
    expect(parseTelegramTopicUrl('')).toBeNull();
    expect(parseTelegramTopicUrl(null as unknown as string)).toBeNull();
  });
});
