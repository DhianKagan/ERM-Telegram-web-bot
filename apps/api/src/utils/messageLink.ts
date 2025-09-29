// Назначение: формирует ссылку на сообщение Telegram по chat_id и message_id
// Основные модули: отсутствуют

export function buildChatMessageLink(
  chatIdValue: string | number | undefined,
  messageId: number | undefined,
): string | null {
  if (!chatIdValue || !messageId) return null;
  const chatId = chatIdValue.toString().trim();
  if (!chatId) return null;
  if (chatId.startsWith('@')) {
    return `https://t.me/${chatId.slice(1)}/${messageId}`;
  }
  if (/^-100\d+$/.test(chatId)) {
    return `https://t.me/c/${chatId.slice(4)}/${messageId}`;
  }
  if (/^\d+$/.test(chatId)) {
    return `https://t.me/c/${chatId}/${messageId}`;
  }
  return null;
}

export default buildChatMessageLink;
