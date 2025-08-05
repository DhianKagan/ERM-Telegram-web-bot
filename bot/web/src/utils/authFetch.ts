/* eslint-env browser */
// Назначение: обёртка для fetch с CSRF-токеном
// Основные модули: fetch, window.location, localStorage
import { getCsrfToken, setCsrfToken } from "./csrfToken";

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  credentials?: string;
  redirect?: string;
  [key: string]: unknown;
}

interface AuthFetchOptions extends FetchOptions {
  noRedirect?: boolean;
}

export default async function authFetch(
  url: string,
  options: AuthFetchOptions = {},
): Promise<Response> {
  const { noRedirect, ...fetchOpts } = options;
  const getToken = getCsrfToken;
  const saveToken = setCsrfToken;
  const headers: Record<string, string> = { ...(fetchOpts.headers || {}) };
  let token = getToken();
  if (!token) {
    try {
      const res = await fetch("/api/v1/csrf", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        csrfToken?: string;
      };
      if (data.csrfToken) {
        token = data.csrfToken;
        saveToken(token);
      }
    } catch {
      /* ignore */
    }
  }
  if (token) headers["X-XSRF-TOKEN"] = token;
  const opts: FetchOptions = { ...fetchOpts, credentials: "include", headers };
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
      const d = (await r.json().catch(() => ({}))) as { csrfToken?: string };
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
  if ((res.status === 401 || res.status === 403) && !noRedirect) {
    window.location.href = "/login?expired=1";
  }
  return res;
}
