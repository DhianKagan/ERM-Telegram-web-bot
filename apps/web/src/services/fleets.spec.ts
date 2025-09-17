// Назначение: проверки сервиса загрузки транспорта флота
// Основные модули: jest, authFetch
jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import authFetch from "../utils/authFetch";
import { fetchFleetVehicles } from "./fleets";

describe("fetchFleetVehicles", () => {
  beforeEach(() => {
    (authFetch as jest.Mock).mockReset();
  });

  it("запрашивает транспорт без параметров", async () => {
    const payload = { fleet: { id: "1", name: "Флот" }, vehicles: [] };
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    const data = await fetchFleetVehicles("1");
    expect(authFetch).toHaveBeenCalledWith("/api/v1/fleets/1/vehicles");
    expect(data).toEqual(payload);
  });

  it("формирует параметры трека", async () => {
    const payload = { fleet: { id: "1", name: "Флот" }, vehicles: [] };
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2024-01-01T01:00:00.000Z");
    await fetchFleetVehicles("5", { track: true, from, to });
    expect(authFetch).toHaveBeenCalledWith(
      `/api/v1/fleets/5/vehicles?track=1&from=${encodeURIComponent(
        from.toISOString(),
      )}&to=${encodeURIComponent(to.toISOString())}`,
    );
  });

  it("отклоняет некорректные даты", async () => {
    await expect(
      fetchFleetVehicles("2", { track: true, from: "nope", to: "later" }),
    ).rejects.toThrow("Некорректная дата для построения трека");
  });

  it("сообщает об ошибке API", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: async () => "Ошибка",
    });
    await expect(fetchFleetVehicles("3")).rejects.toThrow("Ошибка");
  });
});
