// Назначение: запросы к API пользователей
// Основные модули: authFetch
import authFetch from "../utils/authFetch";
import type { User } from "shared";

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

export const updateUser = (id: number | string, data: Partial<User>) =>
  authFetch(`/api/v1/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => r.json());
