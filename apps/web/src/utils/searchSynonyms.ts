// Назначение файла: расширение поисковых токенов синонимами
// Основные модули: нет

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const SYNONYM_GROUPS: string[][] = [
  ['задача', 'задачи', 'task', 'tasks', 'таск', 'тикет'],
  ['заявка', 'заявки', 'request', 'requests', 'req'],
  ['коллекция', 'коллекции', 'collection', 'collections', 'лист'],
  ['справочник', 'справочники', 'directory', 'directories', 'catalog'],
  ['файл', 'файлы', 'file', 'files', 'document', 'doc', 'attachment'],
  ['архив', 'archive', 'history'],
  ['логистика', 'logistics', 'маршрут', 'маршрутный', 'route', 'routes'],
  ['путевой', 'путевый', 'лист', 'route', 'sheet'],
  ['заказ', 'orders', 'order', 'заявка'],
];

const buildSynonymMap = () => {
  const map = new Map<string, string[]>();
  SYNONYM_GROUPS.forEach((group) => {
    const normalized = Array.from(
      new Set(group.map((value) => normalizeToken(value)).filter(Boolean)),
    );
    normalized.forEach((entry) => {
      map.set(
        entry,
        normalized.filter((value) => value !== entry),
      );
    });
  });
  return map;
};

const SYNONYM_MAP = buildSynonymMap();

const tokenize = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

export const expandSearchTokens = (query: string): string[][] =>
  expandSearchTokenGroups(tokenize(query));

export const expandSearchTokenGroups = (tokens: string[]): string[][] => {
  const sanitized = tokens.map(normalizeToken).filter(Boolean);
  if (!sanitized.length) return [];
  return sanitized.map((token) => {
    const synonyms = SYNONYM_MAP.get(token) ?? [];
    return Array.from(new Set([token, ...synonyms]));
  });
};

export const expandSearchVariants = (token: string): string[] => {
  const normalized = normalizeToken(token);
  if (!normalized) return [];
  const synonyms = SYNONYM_MAP.get(normalized) ?? [];
  return Array.from(new Set([normalized, ...synonyms]));
};
