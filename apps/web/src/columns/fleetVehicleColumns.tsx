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
  sensorsInfo: string;
  customSensorsInfo: string;
  trackInfo: string;
  positionInfo: string;
};

export const fleetVehicleColumns: ColumnDef<FleetVehicleRow>[] = [
  {
    accessorKey: "name",
    header: "Название",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "registrationNumber",
    header: "Рег. номер",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "odometerInitial",
    header: "Одометр начальный",
    meta: { minWidth: "8rem", maxWidth: "14rem", renderAsBadges: false },
  },
  {
    accessorKey: "odometerCurrent",
    header: "Одометр текущий",
    meta: { minWidth: "8rem", maxWidth: "14rem", renderAsBadges: false },
  },
  {
    accessorKey: "mileageTotal",
    header: "Пробег",
    meta: { minWidth: "6rem", maxWidth: "12rem", renderAsBadges: false },
  },
  {
    accessorKey: "transportType",
    header: "Тип транспорта",
    meta: { minWidth: "8rem", maxWidth: "14rem", renderAsBadges: false },
  },
  {
    accessorKey: "fuelType",
    header: "Тип топлива",
    meta: { minWidth: "6rem", maxWidth: "12rem", renderAsBadges: false },
  },
  {
    accessorKey: "fuelRefilled",
    header: "Заправлено",
    meta: { minWidth: "6rem", maxWidth: "10rem", renderAsBadges: false },
  },
  {
    accessorKey: "fuelAverageConsumption",
    header: "Расход",
    meta: { minWidth: "6rem", maxWidth: "10rem", renderAsBadges: false },
  },
  {
    accessorKey: "fuelSpentTotal",
    header: "Израсходовано",
    meta: { minWidth: "6rem", maxWidth: "10rem", renderAsBadges: false },
  },
  {
    accessorKey: "currentTasks",
    header: "Текущие задачи",
    cell: ({ getValue }) => stringify(getValue<string[] | undefined>()),
    meta: { minWidth: "10rem", maxWidth: "24rem" },
  },
  {
    accessorKey: "createdAt",
    header: "Создан",
    meta: { minWidth: "10rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "updatedAt",
    header: "Обновлён",
    meta: { minWidth: "10rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "unitId",
    header: "Устройство",
    meta: { minWidth: "8rem", maxWidth: "12rem", renderAsBadges: false },
  },
  {
    accessorKey: "remoteName",
    header: "Удалённое имя",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "notes",
    header: "Примечания",
    meta: { minWidth: "10rem", maxWidth: "20rem", renderAsBadges: false },
  },
  {
    accessorKey: "positionInfo",
    header: "Позиция",
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: "12rem", maxWidth: "24rem", renderAsBadges: false },
  },
  {
    accessorKey: "sensorsInfo",
    header: "Датчики",
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: "12rem", maxWidth: "24rem", renderAsBadges: false },
  },
  {
    accessorKey: "customSensorsInfo",
    header: "Польз. датчики",
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: "12rem", maxWidth: "24rem", renderAsBadges: false },
  },
  {
    accessorKey: "trackInfo",
    header: "Трек",
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: "12rem", maxWidth: "24rem", renderAsBadges: false },
  },
];

