/* eslint-env browser */
// Назначение: API запросы для профиля пользователя
// Основные модули: authFetch
import authFetch from "../utils/authFetch";
import type { User } from "../types/user";

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export const getProfile = async (options?: FetchOptions): Promise<User> => {
  const res = await authFetch("/api/v1/auth/profile", options);
  if (!res.ok) throw new Error("unauthorized");
  const data = await res.json();
  return { ...data, id: String(data.telegram_id ?? "") } as User;
};

interface ProfileData {
  name?: string;
  mobNumber?: string;
}

export const updateProfile = (data: ProfileData) =>
  authFetch("/api/v1/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then((r) => r.json());
