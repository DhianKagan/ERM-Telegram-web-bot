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
import type { FleetVehicleDto } from "shared";
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

const transportHistoryFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatHistoryInstant = (value?: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return transportHistoryFormatter.format(date);
};

const buildHistoryLabel = (
  entry: NonNullable<FleetVehicleDto["transportHistory"]>[number],
): string => {
  const assigned = formatHistoryInstant(entry.assignedAt);
  const removed = formatHistoryInstant(entry.removedAt);
  const title =
    entry.taskTitle && entry.taskTitle.trim().length
      ? entry.taskTitle.trim()
      : entry.taskId;
  if (assigned && removed) {
    return `${assigned} — ${title} (до ${removed})`;
  }
  if (assigned) {
    return `${assigned} — ${title}`;
  }
  if (removed) {
    return `${title} (до ${removed})`;
  }
  return title;
};

const formatTransportHistory = (
  history?: FleetVehicleDto["transportHistory"],
): string => {
  if (!history?.length) {
    return "";
  }
  return history.map(buildHistoryLabel).join("; ");
};

type VehicleCardField = {
  id: string;
  label: string;
  render: (vehicle: FleetVehicleDto) => React.ReactNode;
};

const vehicleCardFields: VehicleCardField[] = [
  {
    id: "id",
    label: "ID",
    render: (vehicle) => vehicle.id,
  },
  {
    id: "name",
    label: "Название",
    render: (vehicle) => vehicle.name,
  },
  {
    id: "registrationNumber",
    label: "Регистрационный номер",
    render: (vehicle) => vehicle.registrationNumber,
  },
  {
    id: "odometerInitial",
    label: "Одометр начальный",
    render: (vehicle) => vehicle.odometerInitial,
  },
  {
    id: "odometerCurrent",
    label: "Одометр текущий",
    render: (vehicle) => vehicle.odometerCurrent,
  },
  {
    id: "mileageTotal",
    label: "Пробег",
    render: (vehicle) => vehicle.mileageTotal,
  },
  {
    id: "payloadCapacityKg",
    label: "Грузоподъёмность, кг",
    render: (vehicle) =>
      typeof vehicle.payloadCapacityKg === "number"
        ? vehicle.payloadCapacityKg
        : "—",
  },
  {
    id: "transportType",
    label: "Тип транспорта",
    render: (vehicle) => vehicle.transportType,
  },
  {
    id: "fuelType",
    label: "Тип топлива",
    render: (vehicle) => vehicle.fuelType,
  },
  {
    id: "fuelRefilled",
    label: "Заправлено",
    render: (vehicle) => vehicle.fuelRefilled,
  },
  {
    id: "fuelAverageConsumption",
    label: "Расход",
    render: (vehicle) => vehicle.fuelAverageConsumption,
  },
  {
    id: "fuelSpentTotal",
    label: "Израсходовано",
    render: (vehicle) => vehicle.fuelSpentTotal,
  },
  {
    id: "currentTasks",
    label: "Задачи",
    render: (vehicle) =>
      vehicle.currentTasks.length ? vehicle.currentTasks.join(", ") : "—",
  },
  {
    id: "transportHistory",
    label: "История задач",
    render: (vehicle) =>
      vehicle.transportHistory?.length ? (
        <ul className="space-y-1 text-sm">
          {vehicle.transportHistory.map((entry) => (
            <li
              key={`${entry.taskId}-${entry.assignedAt}`}
              className="leading-snug"
            >
              {buildHistoryLabel(entry)}
            </li>
          ))}
        </ul>
      ) : (
        "—"
      ),
  },
  {
    id: "createdAt",
    label: "Создан",
    render: (vehicle) => vehicle.createdAt || "—",
  },
  {
    id: "updatedAt",
    label: "Обновлён",
    render: (vehicle) => vehicle.updatedAt || "—",
  },
  {
    id: "unitId",
    label: "Устройство",
    render: (vehicle) =>
      vehicle.unitId !== undefined && vehicle.unitId !== null
        ? vehicle.unitId
        : "—",
  },
  {
    id: "remoteName",
    label: "Удалённое имя",
    render: (vehicle) => vehicle.remoteName || "—",
  },
  {
    id: "notes",
    label: "Примечания",
    render: (vehicle) => vehicle.notes || "—",
  },
];

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
  const [selectedVehicle, setSelectedVehicle] =
    useState<FleetVehicleDto | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_LIMIT)),
    [total],
  );
  const rows = useMemo<FleetVehicleRow[]>(
    () =>
      items.map((item) => ({
        ...item,
        transportHistoryInfo: formatTransportHistory(item.transportHistory),
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
      const data = await listFleetVehicles({
        search: appliedSearch,
        page,
        limit: PAGE_LIMIT,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить транспорт";
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
      {loading ? (
        <p className="text-sm text-gray-500">Загрузка транспорта…</p>
      ) : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
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
      <Modal open={modalOpen} onClose={closeModal}>
        <div className="space-y-4">
          {selectedVehicle ? (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <h3 className="text-base font-semibold">Карточка транспорта</h3>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {vehicleCardFields.map(({ id, label, render }) => (
                  <div key={id}>
                    <dt className="font-medium text-slate-500">{label}</dt>
                    <dd className="text-slate-900">
                      {render(selectedVehicle)}
                    </dd>
                  </div>
                ))}
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
