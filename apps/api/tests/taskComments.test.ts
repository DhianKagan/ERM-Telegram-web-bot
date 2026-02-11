// Назначение: проверка устойчивости обработки HTML-комментариев
// Основные модули: jest, taskComments

describe('taskComments', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('../src/utils/formatTask');
  });

  it('возвращает placeholder для пустого комментария', async () => {
    const { ensureCommentHtml, EMPTY_COMMENT_PLACEHOLDER_HTML } = await import(
      '../src/tasks/taskComments'
    );

    expect(ensureCommentHtml('')).toBe(EMPTY_COMMENT_PLACEHOLDER_HTML);
    expect(ensureCommentHtml(null)).toBe(EMPTY_COMMENT_PLACEHOLDER_HTML);
    expect(ensureCommentHtml(undefined)).toBe(EMPTY_COMMENT_PLACEHOLDER_HTML);
  });

  it('использует fallback, когда convertHtmlToMarkdown выбрасывает ошибку', async () => {
    jest.doMock('../src/utils/formatTask', () => ({
      convertHtmlToMarkdown: jest.fn(() => {
        throw new Error('mocked converter failure');
      }),
    }));

    const { ensureCommentHtml, buildCommentTelegramMessage } = await import(
      '../src/tasks/taskComments'
    );

    const html = '<p>Комментарий <strong>сохранён</strong></p>';

    expect(ensureCommentHtml(html)).toBe(html);
    expect(buildCommentTelegramMessage(html)).toMatchObject({
      parseMode: 'MarkdownV2',
      text: expect.stringMatching(/Комментарий\s+сохранён/),
    });
  });
});
