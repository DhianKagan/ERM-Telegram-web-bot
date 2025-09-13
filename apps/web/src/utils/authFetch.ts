/* eslint-env browser */
// Назначение: обёртка для запросов с CSRF-токеном и прогрессом загрузки
// Основные модули: fetch, XMLHttpRequest, window.location, localStorage
import { getCsrfToken, setCsrfToken } from "./csrfToken";
import { showToast } from "./toast";

interface FetchOptions extends globalThis.RequestInit {
  headers?: Record<string, string>;
  body?: globalThis.BodyInit | null;
  [key: string]: unknown;
}

interface AuthFetchOptions extends FetchOptions {
  noRedirect?: boolean;
  onProgress?: (e: ProgressEvent) => void;
}

async function sendRequest(
  url: string,
  opts: FetchOptions,
  onProgress?: (e: ProgressEvent) => void,
): Promise<Response> {
  if (onProgress && typeof XMLHttpRequest !== "undefined") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || "GET", url);
      xhr.withCredentials = opts.credentials === "include";
      Object.entries(opts.headers || {}).forEach(([k, v]) =>
        xhr.setRequestHeader(k, v),
      );
      xhr.upload.onprogress = onProgress;
      xhr.onload = () => {
        const raw = xhr.getAllResponseHeaders();
        const headers = new Headers();
        if (typeof raw === "string" && raw.trim()) {
          raw
            .trim()
            .split(/\r?\n/)
            .forEach((line) => {
              const [key, val] = line.split(": ");
              if (key) headers.append(key, val);
            });
        }
        resolve(
          new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
          }),
        );
      };
      xhr.onerror = () => reject(new TypeError("Network request failed"));
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      xhr.send(opts.body as any);
    });
  }
  return fetch(url, opts);
}

export default async function authFetch(
  url: string,
  options: AuthFetchOptions = {},
): Promise<Response> {
  const { noRedirect, onProgress, ...fetchOpts } = options;
  const getToken = getCsrfToken;
  const saveToken = setCsrfToken;
  const headers: Record<string, string> = { ...(fetchOpts.headers || {}) };
  let token = getToken();
  if (!token) {
    try {
      const res = await fetch("/api/v1/csrf", { credentials: "include" });
      if (res.ok) {
        const data = (await res
          .json()
          .catch(() => ({}))) as { csrfToken?: string };
        if (data.csrfToken) {
          token = data.csrfToken;
          saveToken(token);
        }
      }
    } catch {
      /* игнорируем */
    }
  }
  if (token) headers["X-XSRF-TOKEN"] = token;
  const opts: FetchOptions = { ...fetchOpts, credentials: "include", headers };
  let res = await sendRequest(url, opts, onProgress);
  if (res.status === 403) {
    if (opts.body) {
      try {
        if (
          typeof opts.body === "string" ||
          (typeof opts.body === "object" &&
            opts.body !== null &&
            !(opts.body instanceof FormData))
        ) {
          localStorage.setItem("csrf_payload", JSON.stringify(opts.body));
        }
      } catch (e) {
        console.error(e);
      }
    }
    try {
      const r = await fetch("/api/v1/csrf", { credentials: "include" });
      if (r.ok) {
        const d = (await r
          .json()
          .catch(() => ({}))) as { csrfToken?: string };
        if (d.csrfToken) {
          saveToken(d.csrfToken);
          headers["X-XSRF-TOKEN"] = d.csrfToken;
        }
      }
    } catch {
      /* игнорируем */
    }
    res = await sendRequest(url, opts, onProgress);
    if (res.ok) {
      try {
        localStorage.removeItem("csrf_payload");
      } catch (e) {
        console.error(e);
      }
    }
  }
  if (res.status === 401) {
    try {
      const r = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        res = await sendRequest(url, opts, onProgress);
      }
    } catch {
      /* игнорируем */
    }
  }
  if (res.status === 403) {
    showToast("Недостаточно прав", "error");
  }
  if (res.status === 401 && !noRedirect) {
    window.location.href = "/login?expired=1";
  }
  return res;
}
