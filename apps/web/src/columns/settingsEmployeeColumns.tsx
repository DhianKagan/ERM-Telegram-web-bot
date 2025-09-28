// Назначение файла: колонки таблицы сотрудников с отображением связанных названий
// Основные модули: @tanstack/react-table, types/user
import type { ColumnDef } from "@tanstack/react-table";
import type { User } from "../types/user";
import { formatRoleName } from "../utils/roleDisplay";

export interface EmployeeRow extends User {
  roleName: string;
  departmentName: string;
  divisionName: string;
  positionName: string;
}

const renderAccess = (value: number | undefined) =>
  value === undefined || value === null ? "" : String(value);

export const settingsEmployeeColumns: ColumnDef<EmployeeRow>[] = [
  {
    accessorKey: "telegram_id",
    header: "Telegram ID",
    meta: { minWidth: "8rem", renderAsBadges: false },
  },
  {
    accessorKey: "username",
    header: "Логин",
    cell: ({ row }) => row.original.telegram_username ?? row.original.username ?? "",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "name",
    header: "Имя",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "phone",
    header: "Телефон",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "mobNumber",
    header: "Моб. номер",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "email",
    header: "E-mail",
    meta: { minWidth: "10rem", maxWidth: "20rem", renderAsBadges: false },
  },
  {
    accessorKey: "role",
    header: "Роль",
    cell: ({ getValue }) => formatRoleName(getValue<string | undefined>()),
    meta: { minWidth: "6rem", maxWidth: "12rem", renderAsBadges: false },
  },
  {
    accessorKey: "access",
    header: "Доступ",
    cell: ({ getValue }) => renderAccess(getValue<number | undefined>()),
    meta: { minWidth: "6rem", maxWidth: "10rem", renderAsBadges: false },
  },
  {
    accessorKey: "roleId",
    header: "Роль ID",
    cell: ({ row }) => formatRoleName(row.original.roleName),
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "departmentId",
    header: "Департамент",
    cell: ({ row }) => row.original.departmentName || "—",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "divisionId",
    header: "Отдел",
    cell: ({ row }) => row.original.divisionName || "—",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
  {
    accessorKey: "positionId",
    header: "Должность",
    cell: ({ row }) => row.original.positionName || "—",
    meta: { minWidth: "8rem", maxWidth: "16rem", renderAsBadges: false },
  },
];
