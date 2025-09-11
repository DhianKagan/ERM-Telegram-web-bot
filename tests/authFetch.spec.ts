/** @jest-environment jsdom */
// Назначение: unit-тесты для authFetch
// Основные модули: jest, authFetch, Response
import authFetch from '../apps/web/src/utils/authFetch';

jest.mock('../apps/web/src/utils/csrfToken', () => ({
  getCsrfToken: () => 'token',
  setCsrfToken: () => undefined,
}));

function makeResponse(status: number, body: any = null): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('authFetch', () => {
  afterEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
    window.location.href = 'http://localhost/';
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
});
