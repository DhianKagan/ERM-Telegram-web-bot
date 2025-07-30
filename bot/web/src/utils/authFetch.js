// Обёртка для fetch с CSRF-токеном из localStorage
// Модули: fetch, window.location, localStorage
export default async function authFetch(url, options = {}) {
  const getToken = () =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem("csrfToken") || undefined
      : undefined;
  const saveToken = (t) => {
    try {
      localStorage.setItem("csrfToken", t);
    } catch (e) {
      console.error(e);
    }
  };
  const headers = { ...(options.headers || {}) };
  let token = getToken();
  if (!token) {
    try {
      const res = await fetch("/api/v1/csrf", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data.csrfToken) {
        token = data.csrfToken;
        saveToken(token);
      }
    } catch {
      /* ignore */
    }
  }
  if (token) headers["X-XSRF-TOKEN"] = token;
  const opts = { ...options, credentials: "include", headers };
  let res = await fetch(url, opts);
  if (res.status === 403) {
    if (opts.body) {
      try {
        localStorage.setItem("csrf_payload", String(opts.body));
      } catch (e) {
        console.error(e);
      }
    }
    try {
      const r = await fetch("/api/v1/csrf", { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (d.csrfToken) {
        saveToken(d.csrfToken);
        headers["X-XSRF-TOKEN"] = d.csrfToken;
      }
    } catch {
      /* ignore */
    }
    res = await fetch(url, opts);
    if (res.ok && opts.body) {
      try {
        localStorage.removeItem("csrf_payload");
      } catch (e) {
        console.error(e);
      }
    }
  }
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/login";
  }
  return res;
}
