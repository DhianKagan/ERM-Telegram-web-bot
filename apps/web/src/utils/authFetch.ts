/* eslint-env browser */
// Назначение: обёртка для запросов с CSRF-токеном и прогрессом загрузки
// Основные модули: fetch, XMLHttpRequest, window.location, localStorage
import { getCsrfToken, setCsrfToken } from './csrfToken';
import { showToast } from './toast';

const unavailablePaths = new Set<string>();

function normalizePath(input: string): string {
  try {
    const base =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'http://localhost';
    return new URL(input, base).pathname;
  } catch {
    return input;
  }
}

const CSRF_PATH = '/api/v1/csrf';
const PROFILE_PATH = '/api/v1/auth/profile';
let csrfRequest: Promise<string | null> | null = null;

interface FetchOptions extends globalThis.RequestInit {
  headers?: Record<string, string>;
  body?: globalThis.BodyInit | null;
  [key: string]: unknown;
}

interface AuthFetchOptions extends FetchOptions {
  noRedirect?: boolean;
  onProgress?: (e: ProgressEvent) => void;
  confirmed?: boolean;
}

type NormalizedXhrBody = Document | globalThis.XMLHttpRequestBodyInit | null;

const isDocument = (value: unknown): value is Document =>
  typeof Document !== 'undefined' && value instanceof Document;

const isFormData = (value: unknown): value is FormData =>
  typeof FormData !== 'undefined' && value instanceof FormData;

const isUrlSearchParams = (value: unknown): value is URLSearchParams =>
  typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;

const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer =>
  typeof SharedArrayBuffer !== 'undefined' &&
  value instanceof SharedArrayBuffer;

const isDataView = (value: unknown): value is DataView =>
  typeof DataView !== 'undefined' && value instanceof DataView;

const isBufferView = (value: unknown): value is ArrayBufferView =>
  typeof ArrayBuffer !== 'undefined' &&
  typeof value === 'object' &&
  value !== null &&
  ArrayBuffer.isView(value) &&
  !(value instanceof DataView);

const cloneBufferSegment = (
  buffer: ArrayBufferLike,
  byteOffset: number,
  byteLength: number,
): ArrayBuffer => {
  const safeLength = Math.max(
    0,
    Math.min(byteLength, buffer.byteLength - byteOffset),
  );
  const target = new Uint8Array(safeLength);
  target.set(new Uint8Array(buffer, byteOffset, safeLength));
  return target.buffer;
};

const normalizeXhrBody = (body: FetchOptions['body']): NormalizedXhrBody => {
  if (body == null) {
    return null;
  }
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    return null;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (
    isDocument(body) ||
    isBlob(body) ||
    isFormData(body) ||
    isUrlSearchParams(body)
  ) {
    return body;
  }
  if (isSharedArrayBuffer(body)) {
    return cloneBufferSegment(body, 0, body.byteLength);
  }
  if (isArrayBuffer(body)) {
    return body;
  }
  if (isDataView(body)) {
    return cloneBufferSegment(body.buffer, body.byteOffset, body.byteLength);
  }
  if (isBufferView(body)) {
    if (isArrayBuffer(body.buffer)) {
      return body as unknown as globalThis.XMLHttpRequestBodyInit;
    }
    return cloneBufferSegment(body.buffer, body.byteOffset, body.byteLength);
  }
  return body as unknown as globalThis.XMLHttpRequestBodyInit;
};

async function sendRequest(
  url: string,
  opts: FetchOptions,
  onProgress?: (e: ProgressEvent) => void,
): Promise<Response> {
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url);
      xhr.withCredentials = opts.credentials === 'include';
      Object.entries(opts.headers || {}).forEach(([k, v]) =>
        xhr.setRequestHeader(k, v),
      );
      xhr.upload.onprogress = onProgress;
      xhr.onload = () => {
        const raw = xhr.getAllResponseHeaders();
        const headers = new Headers();
        if (typeof raw === 'string' && raw.trim()) {
          raw
            .trim()
            .split(/\r?\n/)
            .forEach((line) => {
              const [key, val] = line.split(': ');
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
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
      const body = opts.body ?? null;
      if (
        body &&
        typeof ReadableStream !== 'undefined' &&
        body instanceof ReadableStream
      ) {
        xhr.send();
      } else {
        xhr.send(normalizeXhrBody(body));
      }
    });
  }
  return fetch(url, opts);
}

async function fetchCsrfToken(): Promise<string | null> {
  if (unavailablePaths.has(CSRF_PATH)) {
    return null;
  }
  if (csrfRequest) {
    return csrfRequest;
  }
  csrfRequest = (async () => {
    try {
      const res = await fetch(CSRF_PATH, { credentials: 'include' });
      if (res.status === 404) {
        unavailablePaths.add(CSRF_PATH);
        return null;
      }
      if (!res.ok) {
        return null;
      }
      const data = (await res.json().catch(() => ({}))) as {
        csrfToken?: string;
      };
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        unavailablePaths.delete(CSRF_PATH);
        return data.csrfToken;
      }
    } catch {
      return null;
    }
    return null;
  })();
  try {
    return await csrfRequest;
  } finally {
    csrfRequest = null;
  }
}

export default async function authFetch(
  url: string,
  options: AuthFetchOptions = {},
): Promise<Response> {
  const { noRedirect, onProgress, confirmed, ...fetchOpts } = options;
  const getToken = getCsrfToken;
  const saveToken = setCsrfToken;
  const headers: Record<string, string> = { ...(fetchOpts.headers || {}) };
  const path = normalizePath(url);
  const isProfileRequest = path === PROFILE_PATH;
  if (confirmed && !headers['X-Confirmed-Action']) {
    headers['X-Confirmed-Action'] = 'true';
  }
  let token = getToken();
  if (isProfileRequest && unavailablePaths.has(PROFILE_PATH)) {
    return new Response(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }
  if (!token && !unavailablePaths.has(CSRF_PATH)) {
    token = await fetchCsrfToken();
    if (token) {
      saveToken(token);
    }
  }
  if (token) headers['X-XSRF-TOKEN'] = token;
  const opts: FetchOptions = { ...fetchOpts, credentials: 'include', headers };
  let res = await sendRequest(url, opts, onProgress);
  if (res.status === 404 && isProfileRequest) {
    unavailablePaths.add(PROFILE_PATH);
  } else if (isProfileRequest && res.ok) {
    unavailablePaths.delete(PROFILE_PATH);
  }
  if (res.status === 403 && !unavailablePaths.has(CSRF_PATH)) {
    if (opts.body) {
      try {
        if (
          typeof opts.body === 'string' ||
          (typeof opts.body === 'object' &&
            opts.body !== null &&
            !(opts.body instanceof FormData))
        ) {
          localStorage.setItem('csrf_payload', JSON.stringify(opts.body));
        }
      } catch (e) {
        console.error(e);
      }
    }
    const refreshedToken = await fetchCsrfToken();
    if (refreshedToken) {
      saveToken(refreshedToken);
      headers['X-XSRF-TOKEN'] = refreshedToken;
      res = await sendRequest(url, opts, onProgress);
      if (res.ok) {
        try {
          localStorage.removeItem('csrf_payload');
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
  if (res.status === 401) {
    try {
      const r = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) {
        res = await sendRequest(url, opts, onProgress);
      }
    } catch {
      /* игнорируем */
    }
  }
  if (res.status === 403) {
    showToast('Недостаточно прав', 'error');
  }
  if (res.status === 401 && !noRedirect) {
    window.location.href = '/login?expired=1';
  }
  return res;
}
