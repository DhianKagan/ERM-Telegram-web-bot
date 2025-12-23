// Назначение файла: колонки таблицы основных средств
// Основные модули: @tanstack/react-table
import type { ColumnDef } from '@tanstack/react-table';

export interface FixedAssetRow {
  _id: string;
  name: string;
  inventoryNumber: string;
  location: string;
  description: string;
}

export const fixedAssetColumns: ColumnDef<FixedAssetRow>[] = [
  {
    accessorKey: 'name',
    header: 'Название',
    meta: { minWidth: '10rem', maxWidth: '18rem' },
  },
  {
    accessorKey: 'inventoryNumber',
    header: 'Инвентарный номер',
    meta: { minWidth: '10rem', maxWidth: '16rem' },
  },
  {
    accessorKey: 'location',
    header: 'Расположение',
    meta: { minWidth: '12rem', maxWidth: '22rem' },
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    meta: { minWidth: '12rem', maxWidth: '26rem' },
  },
  {
    accessorKey: '_id',
    header: 'ID',
    meta: { minWidth: '10rem', maxWidth: '16rem' },
  },
];
