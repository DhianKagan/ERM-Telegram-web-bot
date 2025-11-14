/**
 * Назначение файла: проверка экранирования ссылок на пользователей.
 * Основные модули: userLink, mdEscape.
 */
import userLink from '../apps/api/src/utils/userLink';
import escapeMarkdownV2 from '../apps/api/src/utils/mdEscape';

describe('userLink', () => {
  it('экранирует имя и формирует ссылку MarkdownV2', () => {
    const special = '_*[]()~`>#+-=|{}.!\\';
    const link = userLink(42, special);
    expect(link).toBe(`[${escapeMarkdownV2(special)}](tg://user?id=42)`);
  });

  it('использует идентификатор при отсутствии имени', () => {
    const link = userLink('abc_def');
    expect(link).toBe(`[${escapeMarkdownV2('abc_def')}](tg://user?id=abc_def)`);
  });
});
