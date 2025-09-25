// Назначение: сервисные функции для работы с объектами автопарка
// Основные модули: authFetch, shared/FleetVehicleDto
import authFetch from "../utils/authFetch";
import type { FleetVehicleDto } from "shared";

export interface FleetVehiclePayload {
  name: string;
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  fuelType: "Бензин" | "Дизель";
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
}

export interface FleetVehicleResponse {
  items: FleetVehicleDto[];
  total: number;
  page: number;
  limit: number;
}

function parseResponse(res: Response, fallback: string) {
  if (res.ok) return res.json();
  return res.text().then((text) => {
    throw new Error(text || fallback);
  });
}

export async function listFleetVehicles(
  search = "",
  page = 1,
  limit = 10,
): Promise<FleetVehicleResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (search) params.set("search", search);
  const res = await authFetch(`/api/v1/fleets?${params.toString()}`);
  return parseResponse(res, "Не удалось загрузить транспорт");
}

export interface LegacyFleetVehiclesResponse {
  fleet: { id: string; name: string };
  vehicles: FleetVehicleDto[];
}

export async function fetchFleetVehicles(
  _fleetId?: string,
): Promise<LegacyFleetVehiclesResponse> {
  void _fleetId;
  const data = await listFleetVehicles();
  return {
    fleet: { id: "manual-fleet", name: "Автопарк" },
    vehicles: data.items,
  };
}

export async function createFleetVehicle(payload: FleetVehiclePayload): Promise<FleetVehicleDto> {
  const res = await authFetch("/api/v1/fleets", {
    method: "POST",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Не удалось создать транспорт");
}

export async function updateFleetVehicle(
  id: string,
  payload: Partial<FleetVehiclePayload>,
): Promise<FleetVehicleDto> {
  const res = await authFetch(`/api/v1/fleets/${id}`, {
    method: "PUT",
    confirmed: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Не удалось обновить транспорт");
}

export async function deleteFleetVehicle(id: string): Promise<void> {
  const res = await authFetch(`/api/v1/fleets/${id}`, {
    method: "DELETE",
    confirmed: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось удалить транспорт");
  }
}
