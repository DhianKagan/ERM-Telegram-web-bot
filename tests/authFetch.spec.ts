/** @jest-environment jsdom */
// Назначение: unit-тесты для authFetch
// Основные модули: jest, authFetch, Response
import authFetch from '../apps/web/src/utils/authFetch';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  shouldUseBearerAuth,
} from './mocks/webAuth';

jest.mock('../apps/web/src/utils/csrfToken', () => ({
  getCsrfToken: () => 'token',
  setCsrfToken: () => undefined,
}));

function makeResponse(
  status: number,
  body: unknown = null,
  jsonFn?: jest.Mock,
): Response {
  const json = jsonFn || jest.fn().mockResolvedValue(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    json,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

describe('authFetch', () => {
  afterEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
    window.location.href = 'http://localhost/';
    clearAccessToken.mockReset();
    getAccessToken.mockReset();
    getAccessToken.mockReturnValue(null);
    setAccessToken.mockReset();
    shouldUseBearerAuth.mockReset();
    shouldUseBearerAuth.mockReturnValue(false);
  });

  test('отправляет токен и куки', async () => {
    const mockFetch = jest.fn().mockResolvedValue(makeResponse(200));
    // @ts-ignore
    global.fetch = mockFetch;
    await authFetch('/foo', { noRedirect: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/foo',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'token' }),
      }),
    );
  });

  test('refreshes on 401', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(401))
      .mockResolvedValueOnce(makeResponse(200))
      .mockResolvedValueOnce(makeResponse(401));
    // @ts-ignore
    global.fetch = mockFetch;
    const res = await authFetch('/foo', { noRedirect: true });
    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(window.location.href).toBe('http://localhost/');
  });

  test('в bearer-режиме не вызывает /auth/profile без access token', async () => {
    shouldUseBearerAuth.mockReturnValue(true);
    const mockFetch = jest.fn().mockResolvedValue(makeResponse(401));
    // @ts-ignore
    global.fetch = mockFetch;

    const res = await authFetch('/api/v1/auth/profile', { noRedirect: true });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('shows toast on 403', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(403))
      .mockResolvedValueOnce(makeResponse(200, { csrfToken: 't2' }))
      .mockResolvedValueOnce(makeResponse(403));
    // @ts-ignore
    global.fetch = mockFetch;
    const handler = jest.fn();
    window.addEventListener('toast', handler as EventListener);
    await authFetch('/foo');
    expect(handler).toHaveBeenCalled();
    expect(window.location.href).toBe('http://localhost/');
  });

  test('не парсит JSON при ошибках', async () => {
    const json403 = jest.fn().mockResolvedValue({});
    const jsonCsrf = jest.fn().mockResolvedValue({ csrfToken: 't2' });
    const jsonFinal = jest.fn().mockResolvedValue({});
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(403, {}, json403))
      .mockResolvedValueOnce(makeResponse(500, {}, jsonCsrf))
      .mockResolvedValueOnce(makeResponse(403, {}, jsonFinal));
    // @ts-ignore
    global.fetch = mockFetch;
    const handler = jest.fn();
    window.addEventListener('toast', handler as EventListener);
    await authFetch('/bar');
    expect(json403).not.toHaveBeenCalled();
    expect(jsonCsrf).not.toHaveBeenCalled();
    expect(jsonFinal).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  test('корректно читает заголовки XHR без пробела после двоеточия', async () => {
    const OriginalXHR = global.XMLHttpRequest;
    const OriginalResponse = global.Response;
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
        return 'x-test:value-without-space';
      }
      send() {
        this.onload();
      }
    }
    class MockResponse {
      status: number;
      statusText: string;
      ok: boolean;
      headers: Headers;
      constructor(_: unknown, init: ResponseInit = {}) {
        this.status = init.status || 200;
        this.statusText = init.statusText || '';
        this.ok = this.status >= 200 && this.status < 300;
        this.headers = new Headers(init.headers);
      }
    }
    // @ts-ignore
    global.XMLHttpRequest = MockXHR;
    // @ts-ignore
    global.Response = MockResponse;

    const res = await authFetch('/foo', {
      noRedirect: true,
      onProgress: () => undefined,
    });
    expect(res.headers.get('x-test')).toBe('value-without-space');

    // @ts-ignore
    global.XMLHttpRequest = OriginalXHR;
    // @ts-ignore
    global.Response = OriginalResponse;
  });
});
