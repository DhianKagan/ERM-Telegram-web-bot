/* eslint-env browser */
// Назначение: API запросы для профиля пользователя
// Основные модули: authFetch
import authFetch from "../utils/authFetch";

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export const getProfile = async (options?: FetchOptions) => {
  const res = await authFetch("/api/v1/auth/profile", options);
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
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
