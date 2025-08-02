// Формирует ссылку tg://user для MarkdownV2
// Модули: отсутствуют

function mdEscape(str: unknown): string {
  // eslint-disable-next-line no-useless-escape
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export default function userLink(id: number | string, name?: string): string {
  const text = name || String(id);
  return `[${mdEscape(text)}](tg://user?id=${id})`;
}
