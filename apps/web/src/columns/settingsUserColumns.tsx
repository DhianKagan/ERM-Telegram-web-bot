// Назначение файла: колонки таблицы пользователей в настройках
// Основные модули: @tanstack/react-table, types/user
import type { ColumnDef } from '@tanstack/react-table';
import type { User } from '../types/user';
import { formatRoleName } from '../utils/roleDisplay';

export const settingsUserColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'telegram_id',
    header: 'Telegram ID',
    meta: { minWidth: '8rem', truncate: true },
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
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'name',
    header: 'Имя',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'phone',
    header: 'Телефон',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'mobNumber',
    header: 'Моб. номер',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'email',
    header: 'E-mail',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'role',
    header: 'Роль',
    cell: ({ getValue }) => formatRoleName(getValue<string | undefined>()),
    meta: { minWidth: '6rem', truncate: true },
  },
  {
    accessorKey: 'access',
    header: 'Доступ',
    cell: ({ getValue }) => String(getValue<number | undefined>() ?? ''),
    meta: { minWidth: '6rem' },
  },
  {
    accessorKey: 'roleId',
    header: 'Роль ID',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'departmentId',
    header: 'Департамент',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'divisionId',
    header: 'Отдел',
    meta: { minWidth: '8rem', truncate: true },
  },
  {
    accessorKey: 'positionId',
    header: 'Должность',
    meta: { minWidth: '8rem', truncate: true },
  },
];
