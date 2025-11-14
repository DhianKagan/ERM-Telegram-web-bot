// Назначение: запросы к API универсальных коллекций
// Основные модули: authFetch, i18n
import i18n from '../i18n';
import authFetch from '../utils/authFetch';

export interface CollectionItemMeta {
  invalid?: boolean;
  invalidReason?: string;
  invalidCode?: string;
  invalidAt?: string;
  syncPending?: boolean;
  syncWarning?: string;
  syncError?: string;
  syncFailedAt?: string;
  legacy?: boolean;
  readonly?: boolean;
  readonlyReason?: string;
  source?: string;
  sourceId?: string;
  fleetId?: string;
  departmentId?: string;
  divisionId?: string;
  positionId?: string;
  defaultLabel?: string;
  fieldType?: string;
  required?: boolean;
  order?: number;
  virtual?: boolean;
  tg_theme_url?: string;
  tg_chat_id?: string;
  tg_topic_id?: number;
  tg_photos_url?: string;
  tg_photos_chat_id?: string;
  tg_photos_topic_id?: number;
  [key: string]: unknown;
}

export interface CollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
  meta?: CollectionItemMeta;
}

type ProblemValidationError = {
  msg?: string;
  message?: string;
  [key: string]: unknown;
};

type ProblemResponse = {
  error?: string;
  detail?: unknown;
  message?: string;
  errors?: ProblemValidationError[];
};

type ParseErrorOptions = {
  collectionType?: string;
};

const validationMessageKeys: Record<string, string> = {
  'Некорректный тип коллекции': 'collections.errors.invalidType',
  'Тип коллекции обязателен': 'collections.errors.typeRequired',
  'Некорректное название элемента': 'collections.errors.invalidName',
  'Название элемента обязательно': 'collections.errors.nameRequired',
  'Некорректное значение элемента': 'collections.errors.invalidValue',
  'Значение элемента обязательно': 'collections.errors.valueRequired',
  'Значение элемента не может быть пустым': 'collections.errors.valueRequired',
  'Ошибка валидации': 'collections.errors.generalValidation',
  'Ссылка на тему Telegram должна иметь формат https://t.me/c/<id>/<topic>':
    'collections.errors.invalidTelegramTopicUrl',
};

const typeSpecificValidationKeys: Record<string, Record<string, string>> = {
  departments: {
    'Значение элемента обязательно':
      'collections.errors.departmentsMustHaveDivisions',
  },
};

const tryParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const translateValidationMessage = (
  raw: string | undefined,
  options?: ParseErrorOptions,
): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const collectionType = options?.collectionType;
  const specificKey =
    collectionType && typeSpecificValidationKeys[collectionType]?.[trimmed];
  const key = specificKey ?? validationMessageKeys[trimmed];
  if (key) return i18n.t(key);
  return trimmed;
};

const translateValidationErrors = (
  errors: ProblemValidationError[] | undefined,
  options?: ParseErrorOptions,
): string[] => {
  if (!errors?.length) return [];
  const translated = errors
    .map((error) => {
      const base =
        typeof error?.msg === 'string'
          ? error.msg
          : typeof error?.message === 'string'
            ? error.message
            : '';
      return translateValidationMessage(base, options);
    })
    .filter(Boolean);
  if (translated.length) return translated;
  return [i18n.t('collections.errors.generalValidation')];
};

const extractMessagesFromPayload = (
  payload: unknown,
  options?: ParseErrorOptions,
): string[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    const asErrors = payload.filter((item): item is ProblemValidationError =>
      Boolean(item && typeof item === 'object' && 'msg' in item),
    );
    if (asErrors.length) return translateValidationErrors(asErrors, options);
    const directStrings = payload
      .map((item) =>
        typeof item === 'string'
          ? translateValidationMessage(item, options)
          : '',
      )
      .filter(Boolean);
    if (directStrings.length) return directStrings;
  }
  if (typeof payload === 'string') {
    const parsed = tryParseJson(payload);
    if (parsed !== undefined) {
      const nested = extractMessagesFromPayload(parsed, options);
      if (nested.length) return nested;
    }
    const translated = translateValidationMessage(payload, options);
    return translated ? [translated] : [];
  }
  return [];
};

export const parseErrorMessage = (
  status: number,
  body: string,
  options?: ParseErrorOptions,
): string => {
  const fallback =
    status === 429
      ? i18n.t('collections.fallback.rateLimited')
      : status === 403
        ? i18n.t('collections.fallback.forbidden')
        : i18n.t('collections.fallback.loadFailed');

  if (body) {
    const parsed = tryParseJson(body) as ProblemResponse | undefined;
    if (parsed) {
      const errorMessages = translateValidationErrors(parsed.errors, options);
      if (errorMessages.length) {
        return Array.from(new Set(errorMessages)).join('. ');
      }
      const detailMessages = extractMessagesFromPayload(parsed.detail, options);
      if (detailMessages.length) {
        return Array.from(new Set(detailMessages)).join('. ');
      }
      const generalMessage =
        translateValidationMessage(parsed.error, options) ||
        translateValidationMessage(parsed.message, options);
      if (generalMessage) return generalMessage;
    } else {
      const translated = translateValidationMessage(body, options);
      if (translated) return translated;
    }
  }

  return fallback;
};

export const fetchCollectionItems = async (
  type: string,
  search = '',
  page = 1,
  limit = 10,
) => {
  const res = await authFetch(
    `/api/v1/collections?type=${type}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      parseErrorMessage(res.status, body, { collectionType: type }),
    );
  }
  return res.json();
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const fetchAllCollectionItems = async (
  type: string,
  search = '',
  limit = 200,
): Promise<CollectionItem[]> => {
  const effectiveLimit = limit > 0 ? limit : 200;
  const aggregated: CollectionItem[] = [];
  let page = 1;
  let expectedTotal = 0;
  // ограничиваем количество итераций, чтобы избежать бесконечных циклов при ошибках пагинации
  const maxIterations = 100;
  while (page <= maxIterations) {
    const response = (await fetchCollectionItems(
      type,
      search,
      page,
      effectiveLimit,
    )) as { items?: CollectionItem[]; total?: number };
    const items = Array.isArray(response.items) ? response.items : [];
    if (
      !items.length &&
      aggregated.length === 0 &&
      !isFiniteNumber(response.total)
    ) {
      return [];
    }
    aggregated.push(...items);
    if (isFiniteNumber(response.total)) {
      expectedTotal = Math.max(expectedTotal, response.total);
    }
    if (items.length < effectiveLimit) {
      break;
    }
    if (expectedTotal && aggregated.length >= expectedTotal) {
      break;
    }
    page += 1;
  }
  if (expectedTotal && aggregated.length > expectedTotal) {
    return aggregated.slice(0, expectedTotal);
  }
  return aggregated;
};

export const createCollectionItem = (
  type: string,
  data: { name: string; value: string; meta?: Record<string, unknown> },
) =>
  authFetch('/api/v1/collections', {
    method: 'POST',
    confirmed: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...data }),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(
        parseErrorMessage(r.status, body, { collectionType: type }),
      );
    }
    return r.json();
  });

export const updateCollectionItem = (
  id: string,
  data: { name?: string; value?: string; meta?: Record<string, unknown> },
  options?: ParseErrorOptions,
) =>
  authFetch(`/api/v1/collections/${id}`, {
    method: 'PUT',
    confirmed: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(parseErrorMessage(r.status, body, options));
    }
    return r.json();
  });

export const removeCollectionItem = async (id: string) => {
  const r = await authFetch(`/api/v1/collections/${id}`, {
    method: 'DELETE',
    confirmed: true,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(parseErrorMessage(r.status, body));
  }
  return r.json();
};
