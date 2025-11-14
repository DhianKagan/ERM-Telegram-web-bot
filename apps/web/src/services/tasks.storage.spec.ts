/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Назначение файла: проверка fetchTasks при переполненном localStorage и загрузке после профиля.
 * Основные модули: fetchTasks.
 */
jest.mock('../utils/authFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import type {} from '../types/telegram';

import authFetch from '../utils/authFetch';
import { fetchTasks } from './tasks';

describe('fetchTasks', () => {
  test('игнорирует переполнение localStorage', async () => {
    const data = { tasks: [], users: [], total: 0 };
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => data,
    });
    const setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });
    (globalThis as any).localStorage = {
      getItem: () => '',
      setItem,
    };
    const res = await fetchTasks();
    expect(res).toEqual(data);
    expect(setItem).toHaveBeenCalled();
  });
  test('skipCache отключает чтение и запись', async () => {
    const data = { tasks: [], users: [], total: 0 };
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => data,
    });
    const getItem = jest.fn(() => JSON.stringify({ time: Date.now(), data }));
    const setItem = jest.fn();
    (globalThis as any).localStorage = { getItem, setItem };
    const res = await fetchTasks({}, undefined, true);
    expect(res).toEqual(data);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
  test('перезагружает данные после загрузки профиля', async () => {
    jest.clearAllMocks();
    const anonData = { tasks: [], users: [], total: 0 };
    const userData = { tasks: [{ id: 1 }], users: [], total: 1 } as any;
    (authFetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => anonData })
      .mockResolvedValueOnce({ ok: true, json: async () => userData });
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k],
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    const resAnon = await fetchTasks();
    const resUser = await fetchTasks({}, 1);
    expect(resAnon).toEqual(anonData);
    expect(resUser).toEqual(userData);
    expect(authFetch).toHaveBeenCalledTimes(2);
  });
});
