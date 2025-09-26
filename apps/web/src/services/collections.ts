// Назначение: запросы к API универсальных коллекций
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

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
  [key: string]: unknown;
}

export interface CollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
  meta?: CollectionItemMeta;
}

const parseErrorMessage = (status: number, body: string) => {
  let message = "";
  if (body) {
    try {
      const data = JSON.parse(body) as {
        error?: string;
        detail?: string;
        message?: string;
      };
      message = data.error || data.detail || data.message || "";
    } catch {
      message = body;
    }
  }
  if (!message) {
    message =
      status === 429
        ? "Достигнут лимит запросов, попробуйте позже."
        : status === 403
          ? "Нет доступа к коллекции"
          : "Не удалось загрузить элементы";
  }
  return message;
};

export const fetchCollectionItems = async (
  type: string,
  search = "",
  page = 1,
  limit = 10,
) => {
  const res = await authFetch(
    `/api/v1/collections?type=${type}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(parseErrorMessage(res.status, body));
  }
  return res.json();
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const fetchAllCollectionItems = async (
  type: string,
  search = "",
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
    if (!items.length && aggregated.length === 0 && !isFiniteNumber(response.total)) {
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
  data: { name: string; value: string },
) =>
  authFetch("/api/v1/collections", {
    method: "POST",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...data }),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(parseErrorMessage(r.status, body));
    }
    return r.json();
  });

export const updateCollectionItem = (
  id: string,
  data: { name: string; value: string },
) =>
  authFetch(`/api/v1/collections/${id}`, {
    method: "PUT",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(parseErrorMessage(r.status, body));
    }
    return r.json();
  });

export const removeCollectionItem = async (id: string) => {
  const r = await authFetch(`/api/v1/collections/${id}`, {
    method: "DELETE",
    confirmed: true,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(parseErrorMessage(r.status, body));
  }
  return r.json();
};
