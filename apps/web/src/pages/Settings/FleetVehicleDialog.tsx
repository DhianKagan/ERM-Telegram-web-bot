// Назначение: модальное окно создания и редактирования транспорта
// Основные модули: React, ConfirmDialog, services/fleets
import React, { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { FleetVehicleDto } from "shared";
import type { FleetVehiclePayload } from "../../services/fleets";

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
  fuelType: "Бензин" | "Дизель";
  fuelRefilled: string;
  fuelAverageConsumption: string;
  fuelSpentTotal: string;
  currentTasks: string;
}

const emptyForm: FormState = {
  name: "",
  registrationNumber: "",
  odometerInitial: "0",
  odometerCurrent: "0",
  mileageTotal: "0",
  fuelType: "Бензин",
  fuelRefilled: "0",
  fuelAverageConsumption: "0",
  fuelSpentTotal: "0",
  currentTasks: "",
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

  useEffect(() => {
    if (open && vehicle) {
      setForm({
        name: vehicle.name,
        registrationNumber: vehicle.registrationNumber,
        odometerInitial: String(vehicle.odometerInitial),
        odometerCurrent: String(vehicle.odometerCurrent),
        mileageTotal: String(vehicle.mileageTotal),
        fuelType: vehicle.fuelType,
        fuelRefilled: String(vehicle.fuelRefilled),
        fuelAverageConsumption: String(vehicle.fuelAverageConsumption),
        fuelSpentTotal: String(vehicle.fuelSpentTotal),
        currentTasks: vehicle.currentTasks.join("\n"),
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

  const isUpdate = mode === "update" && vehicle;

  const payload = useMemo(() => {
    const base: FleetVehiclePayload = {
      name: form.name.trim(),
      registrationNumber: form.registrationNumber.trim().toUpperCase(),
      odometerInitial: Number(form.odometerInitial || "0"),
      odometerCurrent: Number(form.odometerCurrent || "0"),
      mileageTotal: Number(form.mileageTotal || "0"),
      fuelType: form.fuelType,
      fuelRefilled: Number(form.fuelRefilled || "0"),
      fuelAverageConsumption: Number(form.fuelAverageConsumption || "0"),
      fuelSpentTotal: Number(form.fuelSpentTotal || "0"),
      currentTasks: parseTasks(form.currentTasks),
    };
    return base;
  }, [form]);

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
          <span className="text-sm font-medium">Одометр начальный, км</span>
          <input
            type="number"
            min="0"
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
          <span className="text-sm font-medium">Вид топлива</span>
          <select
            className="h-10 w-full rounded border px-3"
            value={form.fuelType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelType: event.target.value as FormState["fuelType"] }))
            }
            disabled={saving}
          >
            <option value="Бензин">Бензин</option>
            <option value="Дизель">Дизель</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Топлива заправлено</span>
          <input
            type="number"
            min="0"
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
            className="h-10 w-full rounded border px-3"
            value={form.fuelSpentTotal}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, fuelSpentTotal: event.target.value }))
            }
            disabled={saving}
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Текущие задачи (ID через запятую или перенос строки)</span>
        <textarea
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
        <button type="submit" className="btn btn-blue rounded" disabled={saving}>
          Сохранить
        </button>
        <button
          type="button"
          className="btn btn-gray rounded"
          onClick={onClose}
          disabled={saving}
        >
          Отмена
        </button>
        {isUpdate && onDelete ? (
          <button
            type="button"
            className="btn btn-red rounded"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            Удалить
          </button>
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
