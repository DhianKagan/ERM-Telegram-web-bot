// Формирует ссылку tg://user для MarkdownV2
// Основные модули: mdEscape

import { escapeMarkdownV2 } from './mdEscape';

export default function userLink(id: number | string, name?: string): string {
  const text = name || String(id);
  return `[${escapeMarkdownV2(text)}](tg://user?id=${id})`;
}
