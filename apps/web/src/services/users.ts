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
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, username, roleId }),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let message = "Не удалось создать пользователя";
      if (body) {
        try {
          const data = JSON.parse(body) as {
            error?: string;
            message?: string;
            detail?: string;
          };
          message = data.error || data.detail || data.message || message;
        } catch {
          message = body;
        }
      }
      throw new Error(message);
    }
    return r.json();
  });

export const updateUser = (
  id: number | string,
  data: Partial<User>,
): Promise<UserDetails | null> =>
  authFetch(`/api/v1/users/${id}`, {
    method: "PATCH",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async (r) => {
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let message = "Не удалось обновить пользователя";
      if (body) {
        try {
          const parsed = JSON.parse(body) as {
            error?: string;
            detail?: string;
            message?: string;
          };
          message = parsed.error || parsed.detail || parsed.message || message;
        } catch {
          message = body;
        }
      }
      throw new Error(message);
    }
    return r.json();
  });
