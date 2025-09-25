// Назначение: вкладка автопарка с ручным управлением транспортом
// Основные модули: React, services/fleets, FleetVehicleDialog, Modal
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const [editing, setEditing] = useState<FleetVehicleDto | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);

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
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (item: FleetVehicleDto) => {
    setMode("update");
    setEditing(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
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
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && !items.length ? (
        <p className="text-sm text-gray-500">Транспорт не найден.</p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const currentTasks = Array.isArray(item.currentTasks)
            ? item.currentTasks.filter(Boolean)
            : [];

          return (
            <article key={item.id} className="rounded border p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{item.name}</div>
                <div className="text-sm text-gray-600">{item.registrationNumber}</div>
              </div>
              <button
                type="button"
                className="btn btn-gray h-8 rounded px-3 text-xs"
                onClick={() => openEdit(item)}
              >
                Редактировать
              </button>
            </div>
            <dl className="mt-3 space-y-1 text-sm text-gray-700">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Одометр начальный</dt>
                <dd>{item.odometerInitial} км</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Одометр текущий</dt>
                <dd>{item.odometerCurrent} км</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Пробег общий</dt>
                <dd>{item.mileageTotal} км</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Вид топлива</dt>
                <dd>{item.fuelType}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Заправлено</dt>
                <dd>{item.fuelRefilled}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Расход средний</dt>
                <dd>{item.fuelAverageConsumption} л/км</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Израсходовано</dt>
                <dd>{item.fuelSpentTotal} л</dd>
              </div>
            </dl>
            {currentTasks.length ? (
              <div className="mt-3 rounded bg-blue-50 p-2 text-xs text-blue-900">
                Текущие задачи: {currentTasks.join(", ")}
              </div>
            ) : null}
            </article>
          );
        })}
      </div>
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-gray h-8 rounded px-3 text-xs"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            Назад
          </button>
          <span className="text-sm text-gray-600">
            Стр. {page} из {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-gray h-8 rounded px-3 text-xs"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
          >
            Вперёд
          </button>
        </div>
      ) : null}
      <Modal open={modalOpen} onClose={closeModal} title={mode === "create" ? "Новый транспорт" : "Редактирование транспорта"}>
        <FleetVehicleDialog
          open={modalOpen}
          mode={mode}
          vehicle={editing}
          saving={saving}
          onSubmit={submit}
          onDelete={mode === "update" ? remove : undefined}
          onClose={closeModal}
        />
      </Modal>
    </section>
  );
}
