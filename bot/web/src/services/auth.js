/* eslint-env browser, es6 */
// API запросы для регистрации и входа
export const getProfile = () =>
  fetch("/api/v1/auth/profile", { credentials: "include" }).then((r) =>
    r.json(),
  );

export const updateProfile = (data) =>
  fetch("/api/v1/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  }).then((r) => r.json());
