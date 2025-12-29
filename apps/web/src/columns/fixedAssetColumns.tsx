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
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'inventoryNumber',
    header: 'Инвентарный номер',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'location',
    header: 'Расположение',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: '_id',
    header: 'ID',
    meta: { minWidth: '8rem', truncate: true },
  },
];
