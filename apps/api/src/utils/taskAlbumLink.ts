// Назначение: вычисляет ссылку на альбом задачи для Telegram-клавиатур
// Основные модули: utils/messageLink
import buildChatMessageLink from './messageLink';

interface TaskAlbumLinkSource {
  telegram_photos_chat_id?: unknown;
  telegram_photos_message_id?: unknown;
  telegram_photos_topic_id?: unknown;
}

interface TaskAlbumLinkContext {
  fallbackChatId?: string | number | null;
  fallbackTopicId?: number | null;
}

const toNumericId = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeChatId = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
};

const normalizeMessageId = (value: unknown): number | null => {
  const numeric = toNumericId(value);
  if (numeric === null || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
};

const normalizeTopicId = (value: unknown): number | null => {
  const numeric = toNumericId(value);
  if (numeric === null || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
};

export function resolveTaskAlbumLink(
  source: TaskAlbumLinkSource,
  context: TaskAlbumLinkContext = {},
): string | null {
  const explicitChatId = normalizeChatId(source.telegram_photos_chat_id);
  const fallbackChatId = normalizeChatId(context.fallbackChatId);
  const targetChatId = explicitChatId ?? fallbackChatId;
  if (!targetChatId) {
    return null;
  }

  const messageIdNumeric = normalizeMessageId(source.telegram_photos_message_id);
  if (messageIdNumeric === null) {
    return null;
  }

  const explicitTopicId = normalizeTopicId(source.telegram_photos_topic_id);
  const fallbackTopicId = normalizeTopicId(context.fallbackTopicId);
  const topicIdForLink =
    explicitTopicId ??
    (fallbackTopicId &&
      (!explicitChatId || !fallbackChatId || explicitChatId === fallbackChatId)
        ? fallbackTopicId
        : null);

  return (
    buildChatMessageLink(targetChatId, messageIdNumeric, topicIdForLink ?? undefined) ?? null
  );
}

export default resolveTaskAlbumLink;
