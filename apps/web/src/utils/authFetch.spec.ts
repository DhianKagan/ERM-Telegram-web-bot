/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-env jest */
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
});
