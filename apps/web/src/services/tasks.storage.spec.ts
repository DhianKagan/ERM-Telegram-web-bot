/**
 * Назначение файла: проверка fetchTasks при переполненном localStorage.
 * Основные модули: fetchTasks.
 */
jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import type {} from "../types/telegram";

import authFetch from "../utils/authFetch";
import { fetchTasks } from "./tasks";

describe("fetchTasks", () => {
  test("игнорирует переполнение localStorage", async () => {
    const data = { tasks: [], users: [], total: 0 };
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => data,
    });
    const setItem = jest.fn(() => {
      throw new Error("QuotaExceededError");
    });
    (globalThis as any).localStorage = {
      getItem: () => "",
      setItem,
    };
    const res = await fetchTasks();
    expect(res).toEqual(data);
    expect(setItem).toHaveBeenCalled();
  });
});
