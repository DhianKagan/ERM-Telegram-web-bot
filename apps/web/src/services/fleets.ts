// Назначение: сервисные функции для работы с объектами автопарка
// Основные модули: authFetch, shared/FleetVehicleDto
import authFetch from "../utils/authFetch";
import type { Coords, FleetVehicleDto } from "shared";

export interface FleetVehiclePayload {
  name: string;
  registrationNumber: string;
  odometerInitial: number;
  odometerCurrent: number;
  mileageTotal: number;
  payloadCapacityKg: number;
  transportType: "Легковой" | "Грузовой";
  fuelType: "Бензин" | "Дизель" | "Газ";
  fuelRefilled: number;
  fuelAverageConsumption: number;
  fuelSpentTotal: number;
  currentTasks: string[];
  defaultDriverId: number | null;
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

const toNumber = (value: unknown): number | null => {
  if (typeof value !== "number") {
    return null;
  }
  return Number.isFinite(value) ? value : null;
};

const toCoords = (value: unknown): Coords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as Record<string, unknown>;
  const lat =
    toNumber(source.lat) ??
    toNumber(source.latitude) ??
    toNumber(source.latDeg) ??
    toNumber(source.y);
  const lng =
    toNumber(source.lng) ??
    toNumber(source.lon) ??
    toNumber(source.longitude) ??
    toNumber(source.long) ??
    toNumber(source.x);
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng } satisfies Coords;
};

const normalizeVehicle = (vehicle: FleetVehicleDto): FleetVehicleDto => {
  const source = vehicle as FleetVehicleDto & Record<string, unknown>;
  const positionCandidate =
    (source.position as unknown) ??
    (source.lastPosition as unknown) ??
    (source.location as unknown);
  const coordinateCandidate =
    toCoords(source.coordinates) ??
    toCoords(positionCandidate) ??
    toCoords(source.lastKnownPosition);
  const latFallback =
    toNumber(source.lat) ??
    toNumber(source.latitude) ??
    toNumber((positionCandidate as Record<string, unknown> | undefined)?.lat);
  const lngFallback =
    toNumber(source.lng) ??
    toNumber(source.lon) ??
    toNumber(source.longitude) ??
    toNumber((positionCandidate as Record<string, unknown> | undefined)?.lon);
  const coordinates =
    coordinateCandidate ??
    (latFallback !== null && lngFallback !== null
      ? ({ lat: latFallback, lng: lngFallback } as Coords)
      : null);

  const updatedAtCandidate =
    typeof source.coordinatesUpdatedAt === "string"
      ? source.coordinatesUpdatedAt
      : typeof (positionCandidate as Record<string, unknown> | undefined)?.updatedAt ===
        "string"
      ? ((positionCandidate as Record<string, unknown>).updatedAt as string)
      : null;

  const speedCandidate =
    toNumber(source.currentSpeedKph) ??
    toNumber((positionCandidate as Record<string, unknown> | undefined)?.speed) ??
    toNumber((positionCandidate as Record<string, unknown> | undefined)?.speedKph);

  return {
    ...vehicle,
    coordinates: coordinates ?? null,
    coordinatesUpdatedAt: updatedAtCandidate ?? null,
    currentSpeedKph: speedCandidate ?? null,
  } satisfies FleetVehicleDto;
};

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
  const data = (await parseResponse(
    res,
    "Не удалось загрузить транспорт",
  )) as FleetVehicleResponse;
  const items = data.items.map((vehicle) => normalizeVehicle(vehicle));
  return { ...data, items } satisfies FleetVehicleResponse;
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
