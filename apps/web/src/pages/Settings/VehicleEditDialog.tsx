// Назначение: форма редактирования транспорта флота
// Основные модули: React, ConfirmDialog, services/fleets
import React, { useEffect, useMemo, useState } from "react";
import type { VehicleDto } from "shared";
import type { VehicleUpdatePayload } from "../../services/fleets";
import ConfirmDialog from "../../components/ConfirmDialog";

interface Props {
  open: boolean;
  vehicle: VehicleDto | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: VehicleUpdatePayload, mode: "PATCH" | "PUT") => Promise<void>;
}

interface FormState {
  name: string;
  notes: string;
  sensorsJson: string;
  replaceMode: boolean;
}

const emptyForm: FormState = {
  name: "",
  notes: "",
  sensorsJson: "",
  replaceMode: false,
};

const serializeSensors = (sensors: VehicleDto["customSensors"] | undefined) => {
  if (!sensors || !sensors.length) return "";
  try {
    return JSON.stringify(sensors, null, 2);
  } catch {
    return "";
  }
};

export default function VehicleEditDialog({
  open,
  vehicle,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<VehicleUpdatePayload | null>(null);
  const pendingMode = useMemo(() => (form.replaceMode ? "PUT" : "PATCH"), [form.replaceMode]);

  useEffect(() => {
    if (open && vehicle) {
      setForm({
        name: vehicle.name,
        notes: vehicle.notes ?? "",
        sensorsJson: serializeSensors(vehicle.customSensors),
        replaceMode: false,
      });
      setError("");
      setPendingPayload(null);
      setConfirmOpen(false);
    }
    if (!open) {
      setForm(emptyForm);
      setError("");
      setPendingPayload(null);
      setConfirmOpen(false);
    }
  }, [open, vehicle]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicle) return;
    const name = form.name.trim();
    if (!name) {
      setError("Имя обязательно");
      return;
    }
    let sensors: VehicleUpdatePayload["customSensors"] | undefined;
    if (form.sensorsJson.trim()) {
      try {
        const parsed = JSON.parse(form.sensorsJson);
        if (!Array.isArray(parsed)) {
          throw new Error("Датчики должны быть массивом");
        }
        sensors = parsed as VehicleUpdatePayload["customSensors"];
      } catch (parseError) {
        const message =
          parseError instanceof Error ? parseError.message : "Не удалось разобрать датчики";
        setError(message);
        return;
      }
    } else if (form.replaceMode) {
      sensors = [];
    }
    setPendingPayload({
      name,
      notes: form.notes.trim() ? form.notes : null,
      customSensors: sensors,
    });
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingPayload) return;
    try {
      await onSubmit(pendingPayload, pendingMode);
      setConfirmOpen(false);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить транспорт";
      setError(message);
      setConfirmOpen(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium" htmlFor="vehicle-name">
          Имя
        </label>
        <input
          id="vehicle-name"
          className="h-10 w-full rounded border px-3"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          disabled={saving}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="vehicle-notes">
          Примечания
        </label>
        <textarea
          id="vehicle-notes"
          className="min-h-[6rem] w-full rounded border px-3 py-2"
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="vehicle-sensors">
          Дополнительные датчики (JSON-массив)
        </label>
        <textarea
          id="vehicle-sensors"
          className="min-h-[6rem] w-full rounded border px-3 py-2 font-mono text-sm"
          placeholder={`[{
  "name": "Давление",
  "value": 2.4
}]`}
          value={form.sensorsJson}
          onChange={(event) => setForm((prev) => ({ ...prev, sensorsJson: event.target.value }))}
          disabled={saving}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.replaceMode}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, replaceMode: event.target.checked }))
          }
          disabled={saving}
        />
        Перезаписать пустыми значениями (PUT)
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
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
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message="Сохранить изменения транспорта?"
        confirmText="Сохранить"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
