// Назначение файла: колонки таблицы автопарка на странице логистики
// Основные модули: @tanstack/react-table, clsx, shared/types
import type { ColumnDef } from "@tanstack/react-table";
import clsx from "clsx";
import type { FleetVehicleDto } from "shared";

export interface LogisticsFleetRow extends FleetVehicleDto {
  transportTypeLabel: string;
  currentLoadKg: number | null;
  payloadCapacityValue: number | null;
  loadPercent: number | null;
  statusLabel: string;
  statusKey: string;
  assignDisabled?: boolean;
}

interface CreateFleetColumnsOptions {
  onAssign: (vehicle: LogisticsFleetRow) => void;
}

const formatKg = (value: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} кг`;
};

const formatMileage = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} км`;
};

export const createLogisticsFleetColumns = ({
  onAssign,
}: CreateFleetColumnsOptions): ColumnDef<LogisticsFleetRow>[] => [
  {
    accessorKey: "name",
    header: "Транспорт",
    cell: ({ row }) => {
      const vehicle = row.original;
      return (
        <div className="space-y-0.5">
          <div className="leading-tight font-semibold">
            {vehicle.name || "Без названия"}
          </div>
          {vehicle.registrationNumber ? (
            <div className="text-muted-foreground text-xs">
              {vehicle.registrationNumber}
            </div>
          ) : null}
        </div>
      );
    },
    meta: { minWidth: "12rem", maxWidth: "18rem" },
  },
  {
    accessorKey: "transportTypeLabel",
    header: "Тип",
    cell: ({ row }) => row.original.transportTypeLabel || "—",
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    id: "payloadCapacity",
    header: "Грузоподъёмность",
    cell: ({ row }) => formatKg(row.original.payloadCapacityValue ?? null),
    meta: { minWidth: "8rem", maxWidth: "12rem" },
  },
  {
    id: "currentLoad",
    header: "Текущая загрузка",
    cell: ({ row }) => {
      const vehicle = row.original;
      const percent = vehicle.loadPercent ?? 0;
      const safePercent = Math.max(0, Math.min(150, percent));
      const capacity = vehicle.payloadCapacityValue ?? null;
      const current = vehicle.currentLoadKg ?? null;
      const overloaded =
        typeof capacity === "number" &&
        typeof current === "number" &&
        current > capacity;
      return (
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center justify-between text-[11px] font-semibold uppercase">
            <span>{formatKg(current)}</span>
            {capacity ? <span>из {formatKg(capacity)}</span> : null}
          </div>
          <div
            className="h-2 rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, percent))}
          >
            <div
              className={clsx(
                "h-2 rounded-full transition-all",
                overloaded
                  ? "bg-red-500"
                  : percent >= 90
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.max(6, safePercent)}%` }}
            />
          </div>
        </div>
      );
    },
    meta: { minWidth: "12rem", maxWidth: "16rem" },
  },
  {
    id: "mileage",
    header: "Пробег",
    cell: ({ row }) => {
      const vehicle = row.original;
      const mileage = Number.isFinite(vehicle.odometerCurrent)
        ? Number(vehicle.odometerCurrent)
        : Number.isFinite(vehicle.mileageTotal)
          ? Number(vehicle.mileageTotal)
          : null;
      return formatMileage(mileage);
    },
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    id: "status",
    header: "Статус",
    cell: ({ row }) => {
      const vehicle = row.original;
      const badgeClass = clsx(
        "inline-flex min-h-[1.5rem] items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        vehicle.statusKey === "busy"
          ? "bg-amber-100 text-amber-700"
          : vehicle.statusKey === "offline"
            ? "bg-slate-200 text-slate-700"
            : "bg-emerald-100 text-emerald-700",
      );
      return <span className={badgeClass}>{vehicle.statusLabel}</span>;
    },
    meta: { minWidth: "8rem", maxWidth: "12rem" },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => onAssign(row.original)}
        className="border-primary text-primary hover:bg-primary/10 rounded border px-2 py-1 text-xs font-semibold transition disabled:opacity-60"
        disabled={row.original.assignDisabled}
      >
        Назначить задачи
      </button>
    ),
    meta: {
      minWidth: "10rem",
      maxWidth: "12rem",
      headerClassName: "text-right",
    },
  },
];

export default createLogisticsFleetColumns;
