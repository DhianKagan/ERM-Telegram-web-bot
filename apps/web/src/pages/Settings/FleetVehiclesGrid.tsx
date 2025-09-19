// Назначение: отображение транспорта флота в виде карточек
// Основные модули: React, shared/VehicleDto
import React from "react";
import type { VehicleDto } from "shared";

interface Props {
  vehicles: VehicleDto[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onEdit: (vehicle: VehicleDto) => void;
}

function formatSensors(list: VehicleDto["sensors"] | undefined) {
  const sensors = (list ?? []).filter(
    (sensor): sensor is VehicleDto["sensors"][number] => Boolean(sensor),
  );
  if (!sensors.length) return null;
  return (
    <ul className="mt-1 space-y-1 text-sm text-gray-700">
      {sensors.map((sensor, index) => {
        const name = sensor?.name ?? "—";
        return (
          <li key={`${name}-${index}`}>
            <span className="font-medium">{name}</span>: {String(sensor?.value ?? "—")}
          </li>
        );
      })}
    </ul>
  );
}

export default function FleetVehiclesGrid({
  vehicles,
  loading,
  error,
  onRefresh,
  onEdit,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Техника</h3>
        <button
          type="button"
          className="btn btn-blue h-9 rounded px-3"
          onClick={onRefresh}
          disabled={loading}
        >
          Обновить
        </button>
      </div>
      {loading ? <p className="text-sm text-gray-500">Загрузка транспорта…</p> : null}
      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <div>{error}</div>
          <button
            type="button"
            className="btn btn-red mt-2 h-8 rounded px-3 text-xs"
            onClick={onRefresh}
          >
            Повторить
          </button>
        </div>
      ) : null}
      {!loading && !error && !vehicles.length ? (
        <p className="text-sm text-gray-500">Транспорт пока не загружен.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="flex h-full flex-col justify-between rounded border p-3">
            <div>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-medium">{vehicle.name}</div>
                  <div className="text-xs text-gray-500">Юнит #{vehicle.unitId}</div>
                  {vehicle.remoteName && vehicle.remoteName !== vehicle.name ? (
                    <div className="text-xs text-gray-400">Wialon: {vehicle.remoteName}</div>
                  ) : null}
                  {vehicle.updatedAt ? (
                    <div className="text-xs text-gray-400">
                      Обновлено {new Date(vehicle.updatedAt).toLocaleString("ru-RU")}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-gray h-8 rounded px-3 text-xs"
                  onClick={() => onEdit(vehicle)}
                >
                  Редактировать
                </button>
              </div>
              {vehicle.notes ? (
                <p className="mb-2 text-sm text-gray-700">{vehicle.notes}</p>
              ) : null}
              {vehicle.position ? (
                <p className="text-sm text-gray-600">
                  Координаты: {vehicle.position.lat.toFixed(5)}, {vehicle.position.lon.toFixed(5)}
                  {typeof vehicle.position.speed === "number"
                    ? ` • скорость ${Math.round(vehicle.position.speed)} км/ч`
                    : ""}
                </p>
              ) : null}
              {formatSensors(vehicle.sensors)}
              {vehicle.customSensors?.length ? (
                <div className="mt-3 rounded border border-dashed border-gray-300 p-2">
                  <div className="text-xs font-semibold uppercase text-gray-500">
                    Дополнительные датчики
                  </div>
                  {formatSensors(vehicle.customSensors)}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
