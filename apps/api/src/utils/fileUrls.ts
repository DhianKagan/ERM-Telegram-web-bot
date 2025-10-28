// Назначение файла: вспомогательные функции для формирования ссылок на файлы API.
// Основные модули: URLSearchParams

export interface FileUrlOptions {
  inline?: boolean;
  thumbnail?: boolean;
}

const FILE_ROUTE_PREFIX = '/api/v1/files';

export const buildFileUrl = (
  id: unknown,
  options: FileUrlOptions = {},
): string => {
  const value = typeof id === 'string' ? id : String(id);
  const base = `${FILE_ROUTE_PREFIX}/${value}`;
  const params = new URLSearchParams();
  if (options.inline) {
    params.set('mode', 'inline');
  }
  if (options.thumbnail) {
    params.set('variant', 'thumbnail');
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
};

export const buildInlineFileUrl = (id: unknown): string =>
  buildFileUrl(id, { inline: true });

export const buildThumbnailUrl = (id: unknown): string =>
  buildFileUrl(id, { inline: true, thumbnail: true });
