// Назначение файла: колонки таблицы пользователей в настройках
// Основные модули: @tanstack/react-table, types/user
import type { ColumnDef } from "@tanstack/react-table";
import type { User } from "../types/user";
import { formatRoleName } from "../utils/roleDisplay";

export const settingsUserColumns: ColumnDef<User>[] = [
  {
    accessorKey: "telegram_id",
    header: "Telegram ID",
    meta: { minWidth: "8rem" },
  },
  {
    accessorKey: "username",
    header: "Логин",
    cell: ({ row }) => row.original.telegram_username ?? row.original.username ?? "",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "name",
    header: "Имя",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "phone",
    header: "Телефон",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "mobNumber",
    header: "Моб. номер",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "email",
    header: "E-mail",
    meta: { minWidth: "10rem", maxWidth: "20rem" },
  },
  {
    accessorKey: "role",
    header: "Роль",
    cell: ({ getValue }) => formatRoleName(getValue<string | undefined>()),
    meta: { minWidth: "6rem", maxWidth: "12rem" },
  },
  {
    accessorKey: "access",
    header: "Доступ",
    cell: ({ getValue }) => String(getValue<number | undefined>() ?? ""),
    meta: { minWidth: "6rem", maxWidth: "10rem" },
  },
  {
    accessorKey: "roleId",
    header: "Роль ID",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "departmentId",
    header: "Департамент",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "divisionId",
    header: "Отдел",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
  {
    accessorKey: "positionId",
    header: "Должность",
    meta: { minWidth: "8rem", maxWidth: "16rem" },
  },
];

