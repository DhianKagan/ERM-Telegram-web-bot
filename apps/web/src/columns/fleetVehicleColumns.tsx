// Назначение файла: колонки таблицы автопарка на странице настроек
// Основные модули: @tanstack/react-table, shared/types
import type { ColumnDef } from "@tanstack/react-table";
import type { FleetVehicleDto } from "shared";

const stringify = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export type FleetVehicleRow = FleetVehicleDto & {
  transportHistoryInfo: string;
};

export const fleetVehicleColumns: ColumnDef<FleetVehicleRow>[] = [
  {
    accessorKey: "name",
    header: "Название",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "registrationNumber",
    header: "Рег. номер",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "odometerInitial",
    header: "Одометр начальный",
    meta: { minWidth: "8rem", maxWidth: "14rem" },
  },
  {
    accessorKey: "odometerCurrent",
    header: "Одометр текущий",
    meta: { minWidth: "8rem", maxWidth: "14rem" },
  },
  {
    accessorKey: "mileageTotal",
    header: "Пробег",
    meta: { minWidth: "6rem", maxWidth: "12rem" },
  },
  {
    accessorKey: "payloadCapacityKg",
    header: "Грузоподъёмность, кг",
    meta: { minWidth: "8rem", maxWidth: "14rem" },
  },
  {
    accessorKey: "transportType",
    header: "Тип транспорта",
    meta: { minWidth: "8rem", maxWidth: "14rem" },
  },
  {
    accessorKey: "fuelType",
    header: "Тип топлива",
    meta: { minWidth: "6rem", maxWidth: "12rem" },
  },
  {
    accessorKey: "fuelRefilled",
    header: "Заправлено",
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    accessorKey: "fuelAverageConsumption",
    header: "Расход",
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    accessorKey: "fuelSpentTotal",
    header: "Израсходовано",
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    accessorKey: "currentTasks",
    header: "Текущие задачи",
    cell: ({ getValue }) => stringify(getValue<string[] | undefined>()),
    meta: { minWidth: "10rem", maxWidth: "24rem" },
  },
  {
    accessorKey: "transportHistoryInfo",
    header: "История задач",
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: "12rem", maxWidth: "28rem" },
  },
  {
    accessorKey: "createdAt",
    header: "Создан",
    meta: { minWidth: "10rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "updatedAt",
    header: "Обновлён",
    meta: { minWidth: "10rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "unitId",
    header: "Устройство",
    meta: { minWidth: "8rem", maxWidth: "12rem" },
  },
  {
    accessorKey: "remoteName",
    header: "Удалённое имя",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "notes",
    header: "Примечания",
    meta: { minWidth: "10rem", maxWidth: "20rem" },
  },
];

