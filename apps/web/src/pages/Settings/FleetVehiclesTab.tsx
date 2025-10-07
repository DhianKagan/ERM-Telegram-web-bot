// Назначение: вкладка автопарка с ручным управлением транспортом
// Основные модули: React, services/fleets, FleetVehicleDialog, Modal, DataTable
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import { showToast } from "../../utils/toast";
import {
  listFleetVehicles,
  createFleetVehicle,
  updateFleetVehicle,
  deleteFleetVehicle,
  type FleetVehiclePayload,
} from "../../services/fleets";
import type {
  FleetVehicleDto,
  VehiclePositionDto,
  VehicleSensorDto,
  VehicleTrackPointDto,
} from "shared";
import FleetVehicleDialog from "./FleetVehicleDialog";
import {
  fleetVehicleColumns,
  type FleetVehicleRow,
} from "../../columns/fleetVehicleColumns";
import {
  SETTINGS_BADGE_CLASS,
  SETTINGS_BADGE_EMPTY,
  SETTINGS_BADGE_WRAPPER_CLASS,
} from "./badgeStyles";

const PAGE_LIMIT = 10;
const TRACK_POINTS_PREVIEW_LIMIT = 20;

const formatUnknown = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatSensorList = (sensors?: VehicleSensorDto[]): string => {
  if (!sensors?.length) {
    return "";
  }
  return sensors
    .map((sensor) => {
      const parts: string[] = [];
      if (sensor.name) {
        parts.push(sensor.name);
      }
      if (sensor.type) {
        parts.push(`тип: ${sensor.type}`);
      }
      if (sensor.value !== undefined && sensor.value !== null) {
        const sensorValue = formatUnknown(sensor.value);
        if (sensorValue) {
          parts.push(`значение: ${sensorValue}`);
        }
      }
      if (sensor.updatedAt) {
        parts.push(`обновлён: ${sensor.updatedAt}`);
      }
      return parts.join(" • ");
    })
    .filter(Boolean)
    .join("; ");
};

const formatTrackList = (track?: VehicleTrackPointDto[]): string => {
  if (!track?.length) {
    return "";
  }
  const preview = track.slice(0, TRACK_POINTS_PREVIEW_LIMIT);
  const rendered = preview
    .map((point, index) => {
      const parts: string[] = [];
      parts.push(`#${index + 1}`);
      parts.push(`широта: ${point.lat}`);
      parts.push(`долгота: ${point.lon}`);
      if (point.speed !== undefined) {
        parts.push(`скорость: ${point.speed}`);
      }
      if (point.course !== undefined) {
        parts.push(`курс: ${point.course}`);
      }
      parts.push(`время: ${point.timestamp}`);
      return parts.join(" • ");
    })
    .join("; ");
  if (track.length > TRACK_POINTS_PREVIEW_LIMIT) {
    const restCount = track.length - TRACK_POINTS_PREVIEW_LIMIT;
    return `${rendered}; ещё ${restCount}`;
  }
  return rendered;
};

const formatPositionInfo = (position?: VehiclePositionDto): string => {
  if (!position) {
    return "";
  }
  const items: string[] = [
    `широта: ${position.lat}`,
    `долгота: ${position.lon}`,
  ];
  if (position.speed !== undefined) {
    items.push(`скорость: ${position.speed}`);
  }
  if (position.course !== undefined) {
    items.push(`курс: ${position.course}`);
  }
  if (position.updatedAt) {
    items.push(`обновлено: ${position.updatedAt}`);
  }
  return items.join("; ");
};

export default function FleetVehiclesTab() {
  const [items, setItems] = useState<FleetVehicleDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "update">("create");
  const [saving, setSaving] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicleDto | null>(
    null,
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);
  const rows = useMemo<FleetVehicleRow[]>(
    () =>
      items.map((item) => ({
        ...item,
        sensorsInfo: formatSensorList(item.sensors),
        customSensorsInfo: formatSensorList(item.customSensors),
        trackInfo: formatTrackList(item.track),
        positionInfo: formatPositionInfo(item.position),
      })),
    [items],
  );

  const badgeClassName = useMemo(
    () => `${SETTINGS_BADGE_CLASS} whitespace-nowrap sm:text-sm`,
    [],
  );
  const badgeWrapperClassName = useMemo(
    () => `${SETTINGS_BADGE_WRAPPER_CLASS} justify-start`,
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listFleetVehicles(appliedSearch, page, PAGE_LIMIT);
      setItems(data.items);
      setTotal(data.total);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Не удалось загрузить транспорт";
      setError(message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setMode("create");
    setSelectedVehicle(null);
    setModalOpen(true);
  };

  const openEdit = (item: FleetVehicleDto) => {
    setMode("update");
    setSelectedVehicle(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setSelectedVehicle(null);
  };

  const submit = async (payload: FleetVehiclePayload, id?: string) => {
    setSaving(true);
    try {
      if (mode === "create" || !id) {
        await createFleetVehicle(payload);
        showToast("Транспорт создан", "success");
      } else {
        await updateFleetVehicle(id, payload);
        showToast("Транспорт обновлён", "success");
      }
      await load();
      setSelectedVehicle(null);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      await deleteFleetVehicle(id);
      showToast("Транспорт удалён", "success");
      await load();
      setSelectedVehicle(null);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handlePageChange = (next: number) => {
    if (next < 1 || next > totalPages) return;
    setPage(next);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3 lg:items-center lg:gap-3">
        <form
          onSubmit={handleSearchSubmit}
          className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:grid lg:flex-1 lg:grid-cols-[minmax(0,18rem)_auto] lg:items-center lg:gap-3"
        >
          <label className="flex w-full flex-col gap-1 sm:w-64 lg:w-full lg:min-w-0">
            <span className="text-sm font-medium">Поиск</span>
            <input
              id="fleet-vehicles-search"
              name="fleetVehicleSearch"
              className="h-10 w-full rounded border px-3 text-sm lg:h-9 lg:text-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название или номер"
            />
          </label>
          <Button
            type="submit"
            className="h-10 w-full max-w-[11rem] px-3 text-sm font-semibold sm:h-10 sm:w-auto sm:px-3 lg:h-8 lg:text-xs"
          >
            Искать
          </Button>
        </form>
        <Button
          type="button"
          variant="success"
          className="h-10 w-full max-w-[11rem] px-3 text-sm font-semibold sm:w-auto lg:h-8 lg:text-xs"
          onClick={openCreate}
        >
          Добавить
        </Button>
      </div>
      {loading ? <p className="text-sm text-gray-500">Загрузка транспорта…</p> : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}
      {!loading && !error && !items.length ? (
        <p className="text-sm text-gray-500">Транспорт не найден.</p>
      ) : null}
      <DataTable
        columns={fleetVehicleColumns}
        data={rows}
        pageIndex={page - 1}
        pageSize={PAGE_LIMIT}
        pageCount={totalPages}
        onPageChange={(index) => handlePageChange(index + 1)}
        showGlobalSearch={false}
        showFilters={false}
        onRowClick={(row) => openEdit(row)}
        wrapCellsAsBadges
        badgeClassName={badgeClassName}
        badgeWrapperClassName={badgeWrapperClassName}
        badgeEmptyPlaceholder={SETTINGS_BADGE_EMPTY}
      />
      <Modal
        open={modalOpen}
        onClose={closeModal}
      >
        <div className="space-y-4">
          {selectedVehicle ? (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-base font-semibold">Карточка транспорта</h3>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">ID</dt>
                  <dd className="text-slate-900">{selectedVehicle.id}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Название</dt>
                  <dd className="text-slate-900">{selectedVehicle.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Регистрационный номер</dt>
                  <dd className="text-slate-900">
                    {selectedVehicle.registrationNumber}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Одометр начальный</dt>
                  <dd className="text-slate-900">{selectedVehicle.odometerInitial}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Одометр текущий</dt>
                  <dd className="text-slate-900">{selectedVehicle.odometerCurrent}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Пробег</dt>
                  <dd className="text-slate-900">{selectedVehicle.mileageTotal}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Тип транспорта</dt>
                  <dd className="text-slate-900">{selectedVehicle.transportType || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Тип топлива</dt>
                  <dd className="text-slate-900">{selectedVehicle.fuelType}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Заправлено</dt>
                  <dd className="text-slate-900">{selectedVehicle.fuelRefilled}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Расход</dt>
                  <dd className="text-slate-900">
                    {selectedVehicle.fuelAverageConsumption}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Израсходовано</dt>
                  <dd className="text-slate-900">{selectedVehicle.fuelSpentTotal}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Задачи</dt>
                  <dd className="text-slate-900">
                    {selectedVehicle.currentTasks?.length
                      ? selectedVehicle.currentTasks.join(", ")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Создан</dt>
                  <dd className="text-slate-900">
                    {selectedVehicle.createdAt || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Обновлён</dt>
                  <dd className="text-slate-900">
                    {selectedVehicle.updatedAt || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Устройство</dt>
                  <dd className="text-slate-900">{selectedVehicle.unitId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Удалённое имя</dt>
                  <dd className="text-slate-900">{selectedVehicle.remoteName || "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Примечания</dt>
                  <dd className="text-slate-900">{selectedVehicle.notes || "—"}</dd>
                </div>
              </dl>
            </article>
          ) : null}
          <FleetVehicleDialog
            open={modalOpen}
            mode={mode}
            vehicle={selectedVehicle}
            saving={saving}
            onSubmit={submit}
            onDelete={mode === "update" ? remove : undefined}
            onClose={closeModal}
          />
        </div>
      </Modal>
    </section>
  );
}
