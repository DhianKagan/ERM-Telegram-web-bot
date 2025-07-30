/* eslint-env browser, es6 */
// API запросы для регистрации и входа
import authFetch from "../utils/authFetch";

export const getProfile = () =>
  authFetch("/api/v1/auth/profile").then((r) => r.json());

export const updateProfile = (data) =>
  authFetch("/api/v1/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }).then((r) => r.json());
