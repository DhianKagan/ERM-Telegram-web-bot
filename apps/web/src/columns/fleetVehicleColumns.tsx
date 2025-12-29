// Назначение файла: колонки таблицы автопарка на странице настроек
// Основные модули: @tanstack/react-table, shared/types
import type { ColumnDef } from '@tanstack/react-table';
import type { FleetVehicleDto } from 'shared';

const stringify = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '';
  }
  if (typeof value === 'object') {
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
    accessorKey: 'name',
    header: 'Название',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'registrationNumber',
    header: 'Рег. номер',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'odometerInitial',
    header: 'Одометр начальный',
    meta: { minWidth: '8rem' },
  },
  {
    accessorKey: 'odometerCurrent',
    header: 'Одометр текущий',
    meta: { minWidth: '8rem' },
  },
  {
    accessorKey: 'mileageTotal',
    header: 'Пробег',
    meta: { minWidth: '6rem' },
  },
  {
    accessorKey: 'transportType',
    header: 'Тип транспорта',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'fuelType',
    header: 'Тип топлива',
    meta: { minWidth: '6rem', truncate: true },
  },
  {
    accessorKey: 'fuelRefilled',
    header: 'Заправлено',
    meta: { minWidth: '6rem' },
  },
  {
    accessorKey: 'fuelAverageConsumption',
    header: 'Расход',
    meta: { minWidth: '6rem' },
  },
  {
    accessorKey: 'fuelSpentTotal',
    header: 'Израсходовано',
    meta: { minWidth: '6rem' },
  },
  {
    accessorKey: 'currentTasks',
    header: 'Текущие задачи',
    cell: ({ getValue }) => stringify(getValue<string[] | undefined>()),
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'transportHistoryInfo',
    header: 'История задач',
    cell: ({ getValue }) => stringify(getValue<string | undefined>()),
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'createdAt',
    header: 'Создан',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Обновлён',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'unitId',
    header: 'Устройство',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'remoteName',
    header: 'Удалённое имя',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'notes',
    header: 'Примечания',
    meta: { minWidth: '10rem', truncate: true },
  },
];
