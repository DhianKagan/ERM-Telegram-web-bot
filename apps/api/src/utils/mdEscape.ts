// Назначение: экранирование текста для MarkdownV2
// Основные модули: отсутствуют

const MARKDOWN_V2_ESCAPE_REGEXP = /[\\_*\[\]()~`>#+\-=|{}.!]/g;

export function escapeMarkdownV2(value: unknown): string {
  return String(value).replace(MARKDOWN_V2_ESCAPE_REGEXP, '\\$&');
}

export default escapeMarkdownV2;
