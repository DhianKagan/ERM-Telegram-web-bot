// Назначение: сервисные функции для работы с флотами и транспортом
// Основные модули: authFetch, shared/types
import authFetch from "../utils/authFetch";
import type { FleetVehiclesResponse } from "shared";

export interface FleetVehiclesParams {
  track?: boolean;
  from?: Date | string;
  to?: Date | string;
}

const toIsoString = (value: Date | string | undefined): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Некорректная дата для построения трека");
  }
  return parsed.toISOString();
};

export const fetchFleetVehicles = async (
  fleetId: string,
  params: FleetVehiclesParams = {},
): Promise<FleetVehiclesResponse> => {
  const query = new URLSearchParams();
  if (params.track) {
    query.set("track", "1");
    const from = toIsoString(params.from);
    const to = toIsoString(params.to);
    if (!from || !to) {
      throw new Error("Для трека необходимо указать период from и to");
    }
    query.set("from", from);
    query.set("to", to);
  }
  const suffix = query.toString();
  const res = await authFetch(
    `/api/v1/fleets/${fleetId}/vehicles${suffix ? `?${suffix}` : ""}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Не удалось загрузить транспорт флота");
  }
  return res.json();
};
