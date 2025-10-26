// Назначение файла: таблица автопарка с фильтрами и назначением задач
// Основные модули: React, DataTable (лениво), createLogisticsFleetColumns, shared/types
import React, { lazy, Suspense } from "react";
import createLogisticsFleetColumns, {
  type LogisticsFleetRow,
} from "../columns/logisticsFleetColumns";
import type { DataTableProps } from "./DataTable";
import type { FleetVehicleDto } from "shared";

const DataTable = lazy(() => import("./DataTable"));
type FleetDataTableProps = DataTableProps<LogisticsFleetRow>;
const FleetDataTable = DataTable as unknown as React.ComponentType<FleetDataTableProps>;

interface FleetTableProps {
  vehicles: FleetVehicleDto[];
  taskWeightMap?: ReadonlyMap<string, number>;
  onAssign: (vehicle: FleetVehicleDto) => void;
}

const PAGE_SIZE = 10;

const parseWeight = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/, ".");
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
};

const extractWeightFromTask = (
  task: Record<string, unknown>,
): number | null => {
  const candidates = [
    task.cargo_weight_kg,
    task.cargoWeightKg,
    task.weightKg,
    task.weight,
    task.load,
    task.payload,
    task.payloadKg,
  ];
  for (const candidate of candidates) {
    const parsed = parseWeight(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const deriveEntryInfo = (
  entry: unknown,
  weightMap: ReadonlyMap<string, number>,
): { id: string | null; weight: number | null } => {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed) {
      return { id: null, weight: null };
    }
    const weight = weightMap.get(trimmed) ?? null;
    return { id: trimmed, weight };
  }
  if (typeof entry === "number" && Number.isFinite(entry)) {
    const id = entry.toString();
    const weight = weightMap.get(id) ?? null;
    return { id, weight };
  }
  if (!entry || typeof entry !== "object") {
    return { id: null, weight: null };
  }
  const source = entry as Record<string, unknown>;
  const taskIdRaw =
    source.taskId ?? source.task_id ?? source.id ?? source.task ?? null;
  const taskId =
    typeof taskIdRaw === "string"
      ? taskIdRaw.trim()
      : typeof taskIdRaw === "number" && Number.isFinite(taskIdRaw)
        ? taskIdRaw.toString()
        : "";
  const weight =
    extractWeightFromTask(source) ??
    (taskId ? (weightMap.get(taskId) ?? null) : null);
  return { id: taskId || null, weight };
};

const normalizeCapacity = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const deriveStatus = (
  vehicle: FleetVehicleDto,
  hasLoad: boolean,
): { key: string; label: string } => {
  const hasTasks =
    Array.isArray(vehicle.currentTasks) && vehicle.currentTasks.length > 0;
  const updatedAtRaw = vehicle.coordinatesUpdatedAt ?? null;
  const updatedAt =
    typeof updatedAtRaw === "string" && updatedAtRaw
      ? new Date(updatedAtRaw)
      : null;
  const isValidDate = updatedAt ? !Number.isNaN(updatedAt.getTime()) : false;
  const now = Date.now();
  const isFresh =
    isValidDate && now - updatedAt!.getTime() <= 1000 * 60 * 60 * 2;
  if (hasTasks || hasLoad) {
    return { key: "busy", label: "В рейсе" };
  }
  if (!isFresh) {
    return { key: "offline", label: "Нет связи" };
  }
  return { key: "free", label: "Свободен" };
};

const clampPercent = (value: number | null): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
};

const getTransportType = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export default function FleetTable({
  vehicles,
  taskWeightMap = new Map<string, number>(),
  onAssign,
}: FleetTableProps) {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [typeDraft, setTypeDraft] = React.useState<string[]>([]);
  const [statusDraft, setStatusDraft] = React.useState<string[]>([]);
  const [typeFilter, setTypeFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);

  const rows = React.useMemo<LogisticsFleetRow[]>(() => {
    return vehicles.map((vehicle) => {
      const capacity = normalizeCapacity(vehicle.payloadCapacityKg);
      const vehicleSource = vehicle as unknown as Record<string, unknown>;
      const rawTasks = vehicleSource["currentTasks"];
      const currentTasks = Array.isArray(rawTasks)
        ? (rawTasks as unknown[])
        : [];
      let currentLoad = 0;
      currentTasks.forEach((task) => {
        const { weight, id } = deriveEntryInfo(task, taskWeightMap);
        if (typeof weight === "number") {
          currentLoad += weight;
          return;
        }
        if (id) {
          const mappedWeight = taskWeightMap.get(id);
          if (typeof mappedWeight === "number") {
            currentLoad += mappedWeight;
          }
        }
      });
      const hasLoad = currentLoad > 0;
      const status = deriveStatus(vehicle, hasLoad);
      const percent =
        capacity && capacity > 0
          ? clampPercent((currentLoad / capacity) * 100)
          : null;
      const transportTypeLabel = getTransportType(
        vehicle.transportType ?? "",
      );
      return {
        ...vehicle,
        transportTypeLabel,
        payloadCapacityValue: capacity,
        currentLoadKg: hasLoad ? Number(currentLoad.toFixed(1)) : currentLoad,
        loadPercent: percent,
        statusLabel: status.label,
        statusKey: status.key,
        assignDisabled: false,
      } satisfies LogisticsFleetRow;
    });
  }, [taskWeightMap, vehicles]);

  const typeOptions = React.useMemo(() => {
    const items = new Set<string>();
    rows.forEach((row) => {
      if (row.transportTypeLabel) {
        items.add(row.transportTypeLabel);
      }
    });
    return Array.from(items).sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);

  const statusOptions = React.useMemo(() => {
    const entries = new Map<string, string>();
    rows.forEach((row) => {
      entries.set(row.statusKey, row.statusLabel);
    });
    return Array.from(entries.entries()).map(([key, label]) => ({
      key,
      label,
    }));
  }, [rows]);

  React.useEffect(() => {
    setTypeDraft((prev) => prev.filter((value) => typeOptions.includes(value)));
    setTypeFilter((prev) =>
      prev.filter((value) => typeOptions.includes(value)),
    );
  }, [typeOptions]);

  React.useEffect(() => {
    const validKeys = new Set(statusOptions.map((item) => item.key));
    setStatusDraft((prev) => prev.filter((value) => validKeys.has(value)));
    setStatusFilter((prev) => prev.filter((value) => validKeys.has(value)));
  }, [statusOptions]);

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      const typeMatch =
        !typeFilter.length ||
        (row.transportTypeLabel &&
          typeFilter.includes(row.transportTypeLabel));
      const statusMatch =
        !statusFilter.length || statusFilter.includes(row.statusKey);
      return typeMatch && statusMatch;
    });
  }, [rows, statusFilter, typeFilter]);

  const pageCount = React.useMemo(() => {
    return Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  }, [filteredRows.length]);

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [pageCount, pageIndex]);

  const pageData = React.useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageIndex]);

  const columns = React.useMemo(
    () =>
      createLogisticsFleetColumns({
        onAssign: (vehicle) => onAssign(vehicle),
      }),
    [onAssign],
  );

  const applyFilters = () => {
    setTypeFilter(typeDraft);
    setStatusFilter(statusDraft);
    setPageIndex(0);
  };

  const resetFilters = () => {
    setTypeDraft([]);
    setStatusDraft([]);
    setTypeFilter([]);
    setStatusFilter([]);
    setPageIndex(0);
  };

  const renderFilters = () => (
    <details className="relative">
      <summary className="text-muted-foreground cursor-pointer rounded border px-1.5 py-0.5 text-xs font-semibold uppercase shadow-sm">
        Фильтры транспорта
      </summary>
      <div className="absolute z-10 mt-1 w-64 space-y-3 rounded border bg-white p-3 text-xs shadow">
        <div>
          <div className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase">
            Тип транспорта
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {typeOptions.map((type) => {
              const id = `fleet-filter-type-${type}`;
              const checked = typeDraft.includes(type);
              return (
                <label
                  key={type}
                  htmlFor={id}
                  className="flex items-center gap-1.5"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setTypeDraft((prev) =>
                        checked
                          ? prev.filter((value) => value !== type)
                          : [...prev, type],
                      );
                    }}
                  />
                  <span>{type}</span>
                </label>
              );
            })}
            {!typeOptions.length ? (
              <span className="text-muted-foreground block">Нет типов</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase">
            Статус
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {statusOptions.map(({ key, label }) => {
              const id = `fleet-filter-status-${key}`;
              const checked = statusDraft.includes(key);
              return (
                <label
                  key={key}
                  htmlFor={id}
                  className="flex items-center gap-1.5"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setStatusDraft((prev) =>
                        checked
                          ? prev.filter((value) => value !== key)
                          : [...prev, key],
                      );
                    }}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded border px-2 py-1 text-xs font-semibold uppercase"
          >
            Искать
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="text-muted-foreground rounded border px-2 py-1 text-xs"
          >
            Сбросить
          </button>
        </div>
      </div>
    </details>
  );

  const emptyState = !vehicles.length ? (
    <div className="text-muted-foreground rounded border border-dashed p-4 text-center text-sm">
      Транспорт не найден
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      {emptyState && !pageData.length ? emptyState : null}
      {vehicles.length ? (
        <Suspense fallback={<div>Загрузка таблицы...</div>}>
          <FleetDataTable
            columns={columns}
            data={pageData}
            pageIndex={pageIndex}
            pageSize={PAGE_SIZE}
            pageCount={pageCount}
            onPageChange={setPageIndex}
            toolbarChildren={
              <div className="flex items-center gap-2">{renderFilters()}</div>
            }
            showGlobalSearch={false}
            showFilters={false}
            onRowClick={() => undefined}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
