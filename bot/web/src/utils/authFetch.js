// Обёртка для fetch с учётом cookie и CSRF-токена
// Модули: fetch, window.location, document.cookie
export default function authFetch(url, options = {}) {
  const token =
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.slice("XSRF-TOKEN=".length)
      : undefined;
  const headers = { ...(options.headers || {}) };
  if (token) headers["X-XSRF-TOKEN"] = token;
  return fetch(url, { ...options, credentials: "include", headers }).then((res) => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login";
    }
    return res;
  });
}
