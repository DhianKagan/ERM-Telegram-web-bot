// Назначение: формирует ссылку на сообщение Telegram по chat_id и message_id
// Основные модули: отсутствуют

export function buildChatMessageLink(
  chatIdValue: string | number | undefined,
  messageIdValue: number | string | undefined,
  topicIdValue?: number | string | null,
): string | null {
  if (!chatIdValue || messageIdValue === undefined || messageIdValue === null) {
    return null;
  }
  const chatId = chatIdValue.toString().trim();
  if (!chatId) return null;

  const messageId = (() => {
    if (typeof messageIdValue === 'number') {
      return Number.isFinite(messageIdValue) && messageIdValue > 0
        ? Math.trunc(messageIdValue)
        : null;
    }
    if (typeof messageIdValue === 'string') {
      const trimmed = messageIdValue.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  })();
  if (messageId === null) {
    return null;
  }

  const topicId = (() => {
    if (topicIdValue === undefined || topicIdValue === null) {
      return null;
    }
    if (typeof topicIdValue === 'number') {
      return Number.isFinite(topicIdValue) && topicIdValue > 0
        ? Math.trunc(topicIdValue)
        : null;
    }
    if (typeof topicIdValue === 'string') {
      const trimmed = topicIdValue.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  })();

  const buildUrl = (base: string) =>
    topicId !== null ? `${base}/${topicId}/${messageId}` : `${base}/${messageId}`;

  if (chatId.startsWith('@')) {
    return buildUrl(`https://t.me/${chatId.slice(1)}`);
  }
  if (/^-100\d+$/.test(chatId)) {
    return buildUrl(`https://t.me/c/${chatId.slice(4)}`);
  }
  if (/^\d+$/.test(chatId)) {
    return buildUrl(`https://t.me/c/${chatId}`);
  }
  return null;
}

export default buildChatMessageLink;
