// Назначение: проверки сервиса автопарка
// Основные модули: jest, authFetch
jest.mock("../utils/authFetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import authFetch from "../utils/authFetch";
import {
  listFleetVehicles,
  createFleetVehicle,
  updateFleetVehicle,
  deleteFleetVehicle,
  type FleetVehiclePayload,
  fetchFleetVehicles,
} from "./fleets";

describe("listFleetVehicles", () => {
  beforeEach(() => {
    (authFetch as jest.Mock).mockReset();
  });

  it("подставляет параметры поиска", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, limit: 10 }),
    });
    await listFleetVehicles("Газель", 2, 5);
    expect(authFetch).toHaveBeenCalledWith("/api/v1/fleets?page=2&limit=5&search=%D0%93%D0%B0%D0%B7%D0%B5%D0%BB%D1%8C");
  });

  it("бросает ошибку при сбое", async () => {
    (authFetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => "Ошибка" });
    await expect(listFleetVehicles()).rejects.toThrow("Ошибка");
  });
});

describe("fetchFleetVehicles", () => {
  beforeEach(() => {
    (authFetch as jest.Mock).mockReset();
  });

  it("возвращает список в прежнем формате", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: "1", name: "Газель" }], total: 1, page: 1, limit: 10 }),
    });
    const data = await fetchFleetVehicles("any");
    expect(data.vehicles).toHaveLength(1);
    expect(authFetch).toHaveBeenCalledWith("/api/v1/fleets?page=1&limit=10");
  });
});

describe("mutations", () => {
  const payload: FleetVehiclePayload = {
    name: "Погрузчик",
    registrationNumber: "AB 1234 CD",
    odometerInitial: 0,
    odometerCurrent: 10,
    mileageTotal: 10,
    transportType: "Легковой",
    fuelType: "Бензин",
    fuelRefilled: 5,
    fuelAverageConsumption: 0.2,
    fuelSpentTotal: 2,
    currentTasks: [],
  };

  beforeEach(() => {
    (authFetch as jest.Mock).mockReset();
  });

  it("создаёт транспорт", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", ...payload }),
    });
    await createFleetVehicle(payload);
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/fleets",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("обновляет транспорт", async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "1", ...payload }),
    });
    await updateFleetVehicle("1", { name: "Газель" });
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/fleets/1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("удаляет транспорт", async () => {
    (authFetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => "" });
    await deleteFleetVehicle("1");
    expect(authFetch).toHaveBeenCalledWith(
      "/api/v1/fleets/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("обрабатывает ошибки", async () => {
    (authFetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => "Ошибка" });
    await expect(createFleetVehicle(payload)).rejects.toThrow("Ошибка");
  });
});
