// Назначение файла: колонки таблицы универсальных коллекций настроек
// Основные модули: @tanstack/react-table, services/collections
import type { ColumnDef } from '@tanstack/react-table';
import type { CollectionItem } from '../services/collections';

export interface CollectionTableRow extends CollectionItem {
  displayValue: string;
  metaSummary: string;
}

export const collectionColumns: ColumnDef<CollectionTableRow>[] = [
  {
    accessorKey: 'name',
    header: 'Название',
    meta: { minWidth: '8rem', maxWidth: '16rem' },
  },
  {
    accessorKey: 'value',
    header: 'Значение',
    meta: { minWidth: '8rem', maxWidth: '20rem' },
  },
  {
    accessorKey: 'displayValue',
    header: 'Связанные данные',
    meta: { minWidth: '10rem', maxWidth: '24rem' },
  },
  {
    accessorKey: 'type',
    header: 'Тип',
    meta: { minWidth: '6rem', maxWidth: '12rem' },
  },
  {
    accessorKey: '_id',
    header: 'Идентификатор',
    meta: { minWidth: '10rem', maxWidth: '16rem' },
  },
  {
    accessorKey: 'metaSummary',
    header: 'Доп. сведения',
    meta: { minWidth: '10rem', maxWidth: '24rem' },
  },
];
