/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-env jest */

class MockHeaders {
  private readonly store = new Map<string, string>();

  constructor(init?: Record<string, string> | MockHeaders) {
    if (init instanceof MockHeaders) {
      init.forEach((value, key) => this.append(key, value));
      return;
    }
    Object.entries(init || {}).forEach(([key, value]) =>
      this.append(key, value),
    );
  }

  append(key: string, value: string) {
    this.store.set(key.toLowerCase(), value);
  }

  get(key: string) {
    return this.store.get(key.toLowerCase()) ?? null;
  }

  forEach(callback: (value: string, key: string) => void) {
    this.store.forEach((value, key) => callback(value, key));
  }
}

class MockResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: MockHeaders;
  readonly ok: boolean;
  private readonly bodyText: string;

  constructor(
    body?: BodyInit | null,
    init?: {
      status?: number;
      statusText?: string;
      headers?: Record<string, string> | MockHeaders;
    },
  ) {
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? '';
    this.headers =
      init?.headers instanceof MockHeaders
        ? init.headers
        : new MockHeaders(init?.headers);
    this.ok = this.status >= 200 && this.status < 300;
    if (typeof body === 'string') {
      this.bodyText = body;
    } else if (body == null) {
      this.bodyText = '';
    } else {
      this.bodyText = String(body);
    }
  }

  clone() {
    return new MockResponse(this.bodyText, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }

  async json() {
    return this.bodyText ? JSON.parse(this.bodyText) : {};
  }

  async text() {
    return this.bodyText;
  }
}

(globalThis as typeof globalThis & { Headers: typeof MockHeaders }).Headers =
  MockHeaders as unknown as typeof Headers;
(globalThis as typeof globalThis & { Response: typeof MockResponse }).Response =
  MockResponse as unknown as typeof Response;

// Назначение: проверка authFetch при отсутствии заголовков ответа
// Основные модули: authFetch, XMLHttpRequest
const getCsrfTokenMock = jest.fn();
const setCsrfTokenMock = jest.fn();
jest.mock('./csrfToken', () => ({
  getCsrfToken: getCsrfTokenMock,
  setCsrfToken: setCsrfTokenMock,
}));

const showToastMock = jest.fn();
jest.mock('./toast', () => ({
  showToast: showToastMock,
}));

async function loadAuthFetch() {
  jest.resetModules();
  return (await import('./authFetch')).default;
}

class MockXHR {
  response = 'ok';
  status = 200;
  statusText = 'OK';
  withCredentials = false;
  upload = { onprogress: () => undefined };
  onload: () => void = () => undefined;
  onerror: () => void = () => undefined;
  onabort: () => void = () => undefined;
  open() {}
  setRequestHeader() {}
  getAllResponseHeaders() {
    return '';
  }
  send() {
    this.onload();
  }
}

(globalThis as any).XMLHttpRequest = MockXHR as any;

describe('authFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VITE_AUTH_BEARER_ENABLED = '';
    getCsrfTokenMock.mockReturnValue('token');
    (globalThis as any).fetch = jest.fn();
  });

  it('возвращает пустой Headers при отсутствии заголовков', async () => {
    const authFetch = await loadAuthFetch();
    const res = await authFetch('/test', { onProgress: () => undefined });
    expect(res.headers).toBeInstanceOf(Headers);
    expect(res.headers.get('x-test')).toBeNull();
  });

  it('не повторяет запрос /api/v1/csrf после 404', async () => {
    getCsrfTokenMock.mockReturnValueOnce(undefined).mockReturnValue(undefined);
    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValue(new Response(null, { status: 200 }));
    const authFetch = await loadAuthFetch();
    await authFetch('/api/v1/tasks', { noRedirect: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/csrf',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/tasks',
      expect.objectContaining({ credentials: 'include' }),
    );
    fetchMock.mockClear();
    await authFetch('/api/v1/tasks', { noRedirect: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tasks',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('не повторяет запрос профиля после 404', async () => {
    getCsrfTokenMock.mockReturnValueOnce(undefined).mockReturnValue(undefined);
    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const authFetch = await loadAuthFetch();
    const first = await authFetch('/api/v1/auth/profile', { noRedirect: true });
    expect(first.status).toBe(404);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/csrf',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/profile',
      expect.objectContaining({ credentials: 'include' }),
    );
    fetchMock.mockClear();
    const second = await authFetch('/api/v1/auth/profile', {
      noRedirect: true,
    });
    expect(second.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('делит один запрос CSRF между параллельными вызовами', async () => {
    getCsrfTokenMock.mockReturnValue(undefined);
    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    let resolveCsrf: (value: Response) => void = () => undefined;
    const csrfPromise = new Promise<Response>((resolve) => {
      resolveCsrf = resolve;
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (input === '/api/v1/csrf') {
        return csrfPromise;
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    const authFetch = await loadAuthFetch();
    const first = authFetch('/api/v1/tasks', { noRedirect: true });
    const second = authFetch('/api/v1/tasks', { noRedirect: true });
    resolveCsrf(
      new Response(JSON.stringify({ csrfToken: 'token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await Promise.all([first, second]);
    const csrfCalls = fetchMock.mock.calls.filter(
      ([input]) => input === '/api/v1/csrf',
    );
    const taskCalls = fetchMock.mock.calls.filter(
      ([input]) => input === '/api/v1/tasks',
    );
    expect(csrfCalls).toHaveLength(1);
    expect(taskCalls).toHaveLength(2);
  });

  it('в bearer-режиме отправляет X-XSRF-TOKEN на прямой refresh-запрос', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'true';
    getCsrfTokenMock.mockReturnValue('csrf-token');

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const authFetch = await loadAuthFetch();
    const res = await authFetch('/api/v1/auth/refresh', {
      method: 'POST',
      noRedirect: true,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const refreshRequest = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (refreshRequest.headers as Record<string, string>)['X-XSRF-TOKEN'],
    ).toBe('csrf-token');
  });

  it('в bearer-режиме принимает legacy token из refresh-ответа', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'true';
    const authFetch = await loadAuthFetch();
    const { setAccessToken } = await import('../lib/auth');
    setAccessToken('expired-token');

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'legacy-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const res = await authFetch('/api/v1/tasks', { noRedirect: true });

    expect(res.status).toBe(200);
    const retryHeaders = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryHeaders.headers as Record<string, string>).Authorization).toBe(
      'Bearer legacy-token',
    );
  });

  it('в bearer-режиме отправляет Authorization и обновляет access после refresh', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'true';
    const authFetch = await loadAuthFetch();
    const { setAccessToken } = await import('../lib/auth');
    setAccessToken('expired-token');

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const res = await authFetch('/api/v1/tasks', { noRedirect: true });

    expect(res.status).toBe(200);
    const retryHeaders = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryHeaders.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh-token',
    );
  });

  it('в cookie-режиме добавляет Authorization на retry, если refresh вернул accessToken', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'false';

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const authFetch = await loadAuthFetch();
    const res = await authFetch('/api/v1/auth/profile', { noRedirect: true });

    expect(res.status).toBe(200);
    const firstHeaders = fetchMock.mock.calls[0][1] as RequestInit;
    expect(
      (firstHeaders.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    const retryHeaders = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retryHeaders.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh-token',
    );
  });

  it('добавляет X-XSRF-TOKEN при refresh, если csrf доступен', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'false';
    getCsrfTokenMock.mockReturnValue('csrf-token');

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const authFetch = await loadAuthFetch();
    const res = await authFetch('/api/v1/auth/profile', { noRedirect: true });

    expect(res.status).toBe(200);
    const refreshRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(
      (refreshRequest.headers as Record<string, string>)['X-XSRF-TOKEN'],
    ).toBe('csrf-token');
  });

  it('показывает toast о конфигурации, если profile после refresh снова возвращает Bearer-401', async () => {
    process.env.VITE_AUTH_BEARER_ENABLED = 'false';

    const fetchMock = globalThis.fetch as jest.MockedFunction<
      typeof globalThis.fetch
    >;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: 'Not authenticated: Bearer token required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    const authFetch = await loadAuthFetch();
    const res = await authFetch('/api/v1/auth/profile', { noRedirect: true });

    expect(res.status).toBe(401);
    expect(showToastMock).toHaveBeenCalledWith(
      'Ошибка конфигурации окружения: backend требует Bearer для /api/v1/auth/profile.',
      'error',
    );
  });
});
