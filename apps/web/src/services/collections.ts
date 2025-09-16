// Назначение: запросы к API универсальных коллекций
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export interface CollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
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
