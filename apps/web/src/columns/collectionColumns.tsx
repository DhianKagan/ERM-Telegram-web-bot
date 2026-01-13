// Назначение файла: колонки таблицы универсальных коллекций настроек
// Основные модули: @tanstack/react-table, services/collections
import type { ColumnDef } from '@tanstack/react-table';
import type { CollectionItem } from '../services/collections';

export interface CollectionTableRow extends CollectionItem {
  displayValue: string;
  metaSummary: string;
  address?: string;
  coordinates?: string;
}

export const collectionColumns: ColumnDef<CollectionTableRow>[] = [
  {
    accessorKey: 'name',
    header: 'Название',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'value',
    header: 'Значение',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'displayValue',
    header: 'Связанные данные',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'type',
    header: 'Тип',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: '_id',
    header: 'Идентификатор',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'metaSummary',
    header: 'Доп. сведения',
    meta: { minWidth: '10rem', truncate: true },
  },
];

export const collectionObjectColumns: ColumnDef<CollectionTableRow>[] = [
  {
    accessorKey: 'name',
    header: 'Название',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'address',
    header: 'Адрес',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'coordinates',
    header: 'Координаты',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: '_id',
    header: 'Идентификатор',
    meta: { minWidth: '10rem', truncate: true },
  },
];
