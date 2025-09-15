// Назначение: запросы к API пользователей
// Основные модули: authFetch
import authFetch from "../utils/authFetch";
import type { User } from "shared";

export interface UserDetails extends User {
  telegram_username?: string | null;
  email?: string;
  mobNumber?: string;
  name?: string;
}

export const fetchUser = async (
  id: number | string,
): Promise<UserDetails | null> => {
  const res = await authFetch(`/api/v1/users/${id}`, { noRedirect: true });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось загрузить пользователя");
  }
  return res.json();
};

export const fetchUsers = () =>
  authFetch("/api/v1/users").then((r) => (r.ok ? r.json() : []));

export const createUser = (
  id: number | string,
  username?: string,
  roleId?: string,
) =>
  authFetch("/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, username, roleId }),
  }).then((r) => r.json());

export const updateUser = (
  id: number | string,
  data: Partial<User>,
): Promise<UserDetails | null> =>
  authFetch(`/api/v1/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => (r.ok ? r.json() : null));
