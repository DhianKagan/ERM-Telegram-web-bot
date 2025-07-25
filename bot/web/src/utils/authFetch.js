// Обёртка для fetch с учётом cookie и CSRF-токена
// Модули: fetch, window.location, document.cookie
export default async function authFetch(url, options = {}) {
  const getToken = () =>
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.slice("XSRF-TOKEN=".length)
      : undefined;
  const headers = { ...(options.headers || {}) };
  let token = getToken();
  if (!token) {
    await fetch("/api/v1/csrf", { credentials: "include" }).catch(() => {});
    token = getToken();
  }
  if (token) headers["X-XSRF-TOKEN"] = token;
  const opts = { ...options, credentials: "include", headers };
  let res = await fetch(url, opts);
  if (res.status === 403) {
    try {
      const data = await res.clone().json();
      if (data.error === "Invalid CSRF token") {
        if (opts.body) {
          try {
            localStorage.setItem("csrf_payload", String(opts.body));
          } catch (e) {
            console.error(e);
          }
        }
        await fetch("/api/v1/csrf", { credentials: "include" });
        const fresh = getToken();
        if (fresh) headers["X-XSRF-TOKEN"] = fresh;
        res = await fetch(url, opts);
        if (res.ok) {
          try {
            localStorage.removeItem("csrf_payload");
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (err) {
      // Ошибка разбора тела ответа не мешает повторить запрос
      console.error(err);
    }
  }
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login";
  }
  return res;
}
