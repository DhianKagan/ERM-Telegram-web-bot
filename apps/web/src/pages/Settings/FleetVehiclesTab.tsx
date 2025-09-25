// Назначение: вкладка автопарка с ручным управлением транспортом
// Основные модули: React, services/fleets, FleetVehicleDialog, Modal, DataTable
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import DataTable from "../../components/DataTable";
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

const PAGE_LIMIT = 10;

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
        sensorsInfo: item.sensors ? JSON.stringify(item.sensors) : "",
        customSensorsInfo: item.customSensors
          ? JSON.stringify(item.customSensors)
          : "",
        trackInfo: item.track ? JSON.stringify(item.track) : "",
        positionInfo: item.position ? JSON.stringify(item.position) : "",
      })),
    [items],
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex w-full flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="flex w-full flex-col gap-1 sm:w-64">
            <span className="text-sm font-medium">Поиск</span>
            <input
              className="h-10 w-full rounded border px-3"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название или номер"
            />
          </label>
          <button
            type="submit"
            className="btn btn-blue h-10 rounded px-4 sm:h-10 sm:px-4"
          >
            Искать
          </button>
        </form>
        <button
          type="button"
          className="btn btn-green h-10 rounded px-4"
          onClick={openCreate}
        >
          Добавить транспорт
        </button>
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
