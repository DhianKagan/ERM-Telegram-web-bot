// Назначение: модальное окно создания и редактирования транспорта
// Основные модули: React, ConfirmDialog, services/fleets
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { FleetVehicleDto } from "shared";
import type { FleetVehiclePayload } from "../../services/fleets";
import { fetchUsers } from "../../services/users";
import type { User } from "../../types/user";

interface FleetVehicleDialogProps {
  open: boolean;
  mode: "create" | "update";
  vehicle: FleetVehicleDto | null;
  saving: boolean;
  onSubmit: (payload: FleetVehiclePayload, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

interface FormState {
  name: string;
  registrationNumber: string;
  odometerInitial: string;
  odometerCurrent: string;
  mileageTotal: string;
  payloadCapacityKg: string;
  transportType: "Легковой" | "Грузовой";
  fuelType: "Бензин" | "Дизель" | "Газ";
  fuelRefilled: string;
  fuelAverageConsumption: string;
  fuelSpentTotal: string;
  currentTasks: string;
  defaultDriverId: string;
}

const emptyForm: FormState = {
  name: "",
  registrationNumber: "",
  odometerInitial: "0",
  odometerCurrent: "0",
  mileageTotal: "0",
  payloadCapacityKg: "0",
  transportType: "Легковой",
  fuelType: "Бензин",
  fuelRefilled: "0",
  fuelAverageConsumption: "0",
  fuelSpentTotal: "0",
  currentTasks: "",
  defaultDriverId: "",
};

const parseTasks = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function FleetVehicleDialog({
  open,
  mode,
  vehicle,
  saving,
  onSubmit,
  onDelete,
  onClose,
}: FleetVehicleDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const usersLoadedRef = useRef(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
      usersLoadedRef.current = true;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить сотрудников";
      setUsersError(message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && vehicle) {
      const currentTasks = Array.isArray(vehicle.currentTasks)
        ? vehicle.currentTasks.filter(Boolean)
        : [];
      setForm({
        name: vehicle.name,
        registrationNumber: vehicle.registrationNumber,
        odometerInitial: String(vehicle.odometerInitial),
        odometerCurrent: String(vehicle.odometerCurrent),
        mileageTotal: String(vehicle.mileageTotal),
        payloadCapacityKg: String(vehicle.payloadCapacityKg ?? 0),
        transportType: vehicle.transportType,
        fuelType: vehicle.fuelType,
        fuelRefilled: String(vehicle.fuelRefilled),
        fuelAverageConsumption: String(vehicle.fuelAverageConsumption),
        fuelSpentTotal: String(vehicle.fuelSpentTotal),
        currentTasks: currentTasks.join("\n"),
        defaultDriverId:
          typeof vehicle.defaultDriverId === "number"
            ? String(vehicle.defaultDriverId)
            : "",
      });
      setError(null);
      setConfirmSave(false);
      setConfirmDelete(false);
      return;
    }
    if (open && mode === "create") {
      setForm(emptyForm);
      setError(null);
      setConfirmSave(false);
      setConfirmDelete(false);
    }
    if (!open) {
      setForm(emptyForm);
      setError(null);
      setConfirmSave(false);
      setConfirmDelete(false);
    }
  }, [open, mode, vehicle]);

  useEffect(() => {
    if (!open || usersLoadedRef.current || usersLoading) {
      return;
    }
    void loadUsers();
  }, [open, usersLoading, loadUsers]);

  const isUpdate = mode === "update" && vehicle;

  const payload = useMemo(() => {
    const driverCandidate = form.defaultDriverId.trim();
    const parsedDriver = Number.parseInt(driverCandidate, 10);
    const defaultDriverId =
      Number.isFinite(parsedDriver) && parsedDriver > 0 ? parsedDriver : null;
    const base: FleetVehiclePayload = {
      name: form.name.trim(),
      registrationNumber: form.registrationNumber.trim().toUpperCase(),
      odometerInitial: Number(form.odometerInitial || "0"),
      odometerCurrent: Number(form.odometerCurrent || "0"),
      mileageTotal: Number(form.mileageTotal || "0"),
      payloadCapacityKg: Number(form.payloadCapacityKg || "0"),
      transportType: form.transportType,
      fuelType: form.fuelType,
      fuelRefilled: Number(form.fuelRefilled || "0"),
      fuelAverageConsumption: Number(form.fuelAverageConsumption || "0"),
      fuelSpentTotal: Number(form.fuelSpentTotal || "0"),
      currentTasks: parseTasks(form.currentTasks),
      defaultDriverId,
    };
    return base;
  }, [form]);

  const driverOptions = useMemo(() => {
    const options = users
      .filter(
        (user): user is User & { telegram_id: number } =>
          typeof user.telegram_id === "number" && Number.isFinite(user.telegram_id),
      )
      .map((user) => {
        const displayName =
          typeof user.name === "string" && user.name.trim().length > 0
            ? user.name.trim()
            : typeof user.telegram_username === "string" && user.telegram_username.trim().length > 0
              ? user.telegram_username.trim()
              : typeof user.username === "string" && user.username.trim().length > 0
                ? user.username.trim()
                : `ID ${user.telegram_id}`;
        return {
          id: user.telegram_id,
          label: displayName,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
    const selectedValue = form.defaultDriverId.trim();
    const parsedSelected = Number.parseInt(selectedValue, 10);
    if (
      Number.isFinite(parsedSelected) &&
      parsedSelected > 0 &&
      !options.some((option) => option.id === parsedSelected)
    ) {
      options.push({ id: parsedSelected, label: `ID ${parsedSelected}` });
    }
    return options;
  }, [users, form.defaultDriverId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Название обязательно");
      return;
    }
    if (!/^[A-ZА-ЯІЇЄ]{2} \d{4} [A-ZА-ЯІЇЄ]{2}$/u.test(payload.registrationNumber)) {
      setError("Регистрационный номер должен быть в формате XX 0000 XX");
      return;
    }
    setError(null);
    setConfirmSave(true);
  };

  const handleConfirm = async () => {
    try {
      await onSubmit(payload, vehicle?.id);
      setConfirmSave(false);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить транспорт";
      setError(message);
      setConfirmSave(false);
    }
  };

  const handleDelete = async () => {
    if (!vehicle || !onDelete) return;
    try {
      await onDelete(vehicle.id);
      setConfirmDelete(false);
      onClose();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить транспорт";
      setError(message);
      setConfirmDelete(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Название</span>
          <input
            id="fleet-vehicle-name"
            name="name"
            className="h-10 w-full rounded border px-3"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Регистрационный номер</span>
          <input
            id="fleet-vehicle-registration"
            name="registrationNumber"
            className="h-10 w-full rounded border px-3 uppercase"
            value={form.registrationNumber}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, registrationNumber: event.target.value }))
            }
            disabled={saving}
            required
            placeholder="AA 1234 BB"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Тип транспорта</span>
          <select
            id="fleet-vehicle-transport-type"
            name="transportType"
            className="h-10 w-full rounded border px-3"
            value={form.transportType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, transportType: event.target.value as FormState["transportType"] }))
            }
            disabled={saving}
            required
          >
            <option value="Легковой">Легковой</option>
            <option value="Грузовой">Грузовой</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Одометр начальный, км</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-odometer-initial"
            name="odometerInitial"
            className="h-10 w-full rounded border px-3"
            value={form.odometerInitial}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, odometerInitial: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Одометр текущий, км</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-odometer-current"
            name="odometerCurrent"
            className="h-10 w-full rounded border px-3"
            value={form.odometerCurrent}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, odometerCurrent: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Пробег общий, км</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-mileage-total"
            name="mileageTotal"
            className="h-10 w-full rounded border px-3"
            value={form.mileageTotal}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, mileageTotal: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Грузоподъёмность, кг</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-payload"
            name="payloadCapacityKg"
            className="h-10 w-full rounded border px-3"
            value={form.payloadCapacityKg}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, payloadCapacityKg: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Вид топлива</span>
          <select
            id="fleet-vehicle-fuel-type"
            name="fuelType"
            className="h-10 w-full rounded border px-3"
            value={form.fuelType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelType: event.target.value as FormState["fuelType"] }))
            }
            disabled={saving}
          >
            <option value="Бензин">Бензин</option>
            <option value="Дизель">Дизель</option>
            <option value="Газ">Газ</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Топлива заправлено</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-fuel-refilled"
            name="fuelRefilled"
            className="h-10 w-full rounded border px-3"
            value={form.fuelRefilled}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelRefilled: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Расход средний, л/км</span>
          <input
            type="number"
            min="0"
            step="0.01"
            id="fleet-vehicle-fuel-average"
            name="fuelAverageConsumption"
            className="h-10 w-full rounded border px-3"
            value={form.fuelAverageConsumption}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelAverageConsumption: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Затрачено топлива всего, л</span>
          <input
            type="number"
            min="0"
            id="fleet-vehicle-fuel-spent"
            name="fuelSpentTotal"
            className="h-10 w-full rounded border px-3"
            value={form.fuelSpentTotal}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelSpentTotal: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium">Водитель по умолчанию</span>
          <select
            className="h-10 w-full rounded border px-3"
            value={form.defaultDriverId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, defaultDriverId: event.target.value }))
            }
            disabled={saving || usersLoading}
          >
            <option value="">Не выбран</option>
            {driverOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {usersLoading ? (
            <span className="text-xs text-slate-500">Загружаем список сотрудников…</span>
          ) : null}
          {usersError ? (
            <span className="text-xs text-red-600">
              {usersError}
              <button
                type="button"
                className="ml-2 text-accentPrimary underline decoration-dotted"
                onClick={() => {
                  usersLoadedRef.current = false;
                  void loadUsers();
                }}
              >
                Повторить
              </button>
            </span>
          ) : null}
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Текущие задачи (ID через запятую или перенос строки)</span>
        <textarea
          id="fleet-vehicle-current-tasks"
          name="currentTasks"
          className="min-h-[5rem] w-full rounded border px-3 py-2"
          value={form.currentTasks}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, currentTasks: event.target.value }))
          }
          disabled={saving}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          Сохранить
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          Отмена
        </Button>
        {isUpdate && onDelete ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            Удалить
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmSave}
        message="Сохранить транспорт?"
        confirmText="Сохранить"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmSave(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        message="Удалить транспорт?"
        confirmText="Удалить"
        status="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
