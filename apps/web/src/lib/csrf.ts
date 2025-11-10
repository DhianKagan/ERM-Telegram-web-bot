// apps/web/src/lib/csrf.ts
// Preload CSRF token and helper fetch that sends X-XSRF-TOKEN for mutating requests.

const API_BASE = (import.meta as any).env?.VITE_ROUTING_URL || '';
let __csrfToken: string | null = null;

export async function preloadCsrf(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/csrf`, {
      method: 'GET',
      credentials: 'include'
    });
    // токен может прийти как тело/заголовок; сервер lusca добавляет req.csrfToken()
    // здесь пытаемся достать из JSON { token } либо из заголовков 'x-csrf-token'
    let token: string | null = null;
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        token = j?.token || j?.csrf || null;
      }
    } catch { /* ignore */ }
    if (!token) token = res.headers.get('x-csrf-token');
    if (token) __csrfToken = token;
  } catch { /* offline/dev noop */ }
}

export async function csrfFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : (input as Request).url;
  const method = (init.method || 'GET').toUpperCase();
  const shouldAttach = ['POST','PUT','PATCH','DELETE'].includes(method);
  const headers = new Headers(init.headers || {});
  if (shouldAttach && __csrfToken) headers.set('X-XSRF-TOKEN', __csrfToken);
  return fetch(url, { ...init, headers, credentials: init.credentials || 'include' });
}
