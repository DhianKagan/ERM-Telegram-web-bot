// Назначение файла: колонки таблицы журнала событий
// Основные модули: @tanstack/react-table
import type { ColumnDef } from '@tanstack/react-table';

export interface EventLogRow {
  id: string;
  number: string;
  date: string;
  asset: string;
  location: string;
  description: string;
}

export const eventLogColumns: ColumnDef<EventLogRow>[] = [
  {
    accessorKey: 'number',
    header: 'Номер',
    meta: { minWidth: '8rem', maxWidth: '12rem' },
  },
  {
    accessorKey: 'date',
    header: 'Дата',
    meta: { minWidth: '8rem', maxWidth: '12rem' },
  },
  {
    accessorKey: 'asset',
    header: 'Объект',
    meta: { minWidth: '12rem', maxWidth: '20rem' },
  },
  {
    accessorKey: 'location',
    header: 'Место',
    meta: { minWidth: '10rem', maxWidth: '20rem' },
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    meta: { minWidth: '16rem', maxWidth: '28rem' },
  },
];
