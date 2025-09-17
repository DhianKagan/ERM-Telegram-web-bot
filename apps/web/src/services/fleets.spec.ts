// Назначение: проверки сервиса загрузки транспорта флота
// Основные модули: jest, authFetch
jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import authFetch from "../utils/authFetch";
import {
  fetchFleetVehicles,
  patchFleetVehicle,
  replaceFleetVehicle,
  type VehicleUpdatePayload,
} from "./fleets";

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

describe("mutations", () => {
  beforeEach(() => {
    (authFetch as jest.Mock).mockReset();
  });

  const payload: VehicleUpdatePayload = { name: "Погрузчик", notes: "Сервис" };

  it("обновляет транспорт через PATCH", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });
    await patchFleetVehicle("f1", "v1", payload);
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/fleets/f1/vehicles/v1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("заменяет транспорт через PUT", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1" }),
    });
    await replaceFleetVehicle("f2", "v3", payload);
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/fleets/f2/vehicles/v3",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("сообщает об ошибке при сбое", async () => {
    (authFetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => "Ошибка" });
    await expect(patchFleetVehicle("f1", "v1", payload)).rejects.toThrow("Ошибка");
  });
});
