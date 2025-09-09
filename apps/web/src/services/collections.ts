// Назначение: запросы к API универсальных коллекций
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

export interface CollectionItem {
  _id: string;
  type: string;
  name: string;
  value: string;
}

export const fetchCollectionItems = (
  type: string,
  search = "",
  page = 1,
  limit = 10,
) =>
  authFetch(
    `/api/v1/collections?type=${type}&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
  ).then((r) => (r.ok ? r.json() : { items: [], total: 0 }));

export const createCollectionItem = (
  type: string,
  data: { name: string; value: string },
) =>
  authFetch("/api/v1/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...data }),
  }).then((r) => r.json());

export const updateCollectionItem = (
  id: string,
  data: { name: string; value: string },
) =>
  authFetch(`/api/v1/collections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const removeCollectionItem = (id: string) =>
  authFetch(`/api/v1/collections/${id}`, { method: "DELETE" }).then((r) =>
    r.json(),
  );
