// Назначение файла: колонки таблицы сотрудников с отображением связанных названий
// Основные модули: @tanstack/react-table, types/user
import type { ColumnDef } from '@tanstack/react-table';
import type { User } from '../types/user';
import { formatRoleName } from '../utils/roleDisplay';

export interface EmployeeRow extends User {
  roleName: string;
  departmentName: string;
  divisionName: string;
  positionName: string;
}

const renderAccess = (value: number | undefined) =>
  value === undefined || value === null ? '' : String(value);

export const settingsEmployeeColumns: ColumnDef<EmployeeRow>[] = [
  {
    accessorKey: 'telegram_id',
    header: 'Telegram ID',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'username',
    header: 'Логин',
    cell: ({ row }) => {
      const value =
        row.original.telegram_username ?? row.original.username ?? '';
      return (
        <span className="block truncate" title={value}>
          {value}
        </span>
      );
    },
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'name',
    header: 'Имя',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'phone',
    header: 'Телефон',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'mobNumber',
    header: 'Моб. номер',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'email',
    header: 'E-mail',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'role',
    header: 'Роль',
    cell: ({ getValue }) => formatRoleName(getValue<string | undefined>()),
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'access',
    header: 'Доступ',
    cell: ({ getValue }) => renderAccess(getValue<number | undefined>()),
    meta: { minWidth: '10rem' },
  },
  {
    accessorKey: 'roleId',
    header: 'Роль ID',
    cell: ({ row }) => formatRoleName(row.original.roleName),
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'departmentId',
    header: 'Департамент',
    cell: ({ row }) => row.original.departmentName || '—',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'divisionId',
    header: 'Отдел',
    cell: ({ row }) => row.original.divisionName || '—',
    meta: { minWidth: '10rem', truncate: true },
  },
  {
    accessorKey: 'positionId',
    header: 'Должность',
    cell: ({ row }) => row.original.positionName || '—',
    meta: { minWidth: '10rem', truncate: true },
  },
];
