// Назначение: нормализация данных пользователя и связанных ссылок
// Основные модули: types/user
import type { User } from "../types/user";

type ReferenceLike =
  | string
  | { _id?: unknown; id?: unknown; name?: unknown; label?: unknown }
  | null
  | undefined;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getReferenceId = (value: ReferenceLike): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return toTrimmedString(value);
  if (typeof value !== "object") return undefined;
  const withId = value as { _id?: unknown; id?: unknown };
  return (
    toTrimmedString(withId._id) ||
    toTrimmedString(withId.id)
  );
};

export const getReferenceName = (value: ReferenceLike): string | undefined => {
  if (!value || typeof value === "string") return undefined;
  if (typeof value !== "object") return undefined;
  const withName = value as { name?: unknown; label?: unknown };
  return toTrimmedString(withName.name) || toTrimmedString(withName.label);
};

type NormalizedFields = Pick<
  User,
  | "roleId"
  | "roleName"
  | "departmentId"
  | "departmentName"
  | "divisionId"
  | "divisionName"
  | "positionId"
  | "positionName"
>;

export const normalizeUser = <T extends Partial<User>>(user: T): T & NormalizedFields => {
  const source = user as Record<string, unknown>;

  const roleId =
    getReferenceId(source.roleId as ReferenceLike) ||
    (typeof user.roleId === "string" ? user.roleId.trim() || undefined : undefined);
  const roleName =
    getReferenceName(source.roleId as ReferenceLike) ||
    (typeof user.roleName === "string" ? user.roleName.trim() || undefined : undefined);

  const departmentId =
    getReferenceId(source.departmentId as ReferenceLike) ||
    (typeof user.departmentId === "string"
      ? user.departmentId.trim() || undefined
      : undefined);
  const departmentName =
    getReferenceName(source.departmentId as ReferenceLike) ||
    (typeof user.departmentName === "string"
      ? user.departmentName.trim() || undefined
      : undefined);

  const divisionId =
    getReferenceId(source.divisionId as ReferenceLike) ||
    (typeof user.divisionId === "string"
      ? user.divisionId.trim() || undefined
      : undefined);
  const divisionName =
    getReferenceName(source.divisionId as ReferenceLike) ||
    (typeof user.divisionName === "string"
      ? user.divisionName.trim() || undefined
      : undefined);

  const positionId =
    getReferenceId(source.positionId as ReferenceLike) ||
    (typeof user.positionId === "string"
      ? user.positionId.trim() || undefined
      : undefined);
  const positionName =
    getReferenceName(source.positionId as ReferenceLike) ||
    (typeof user.positionName === "string"
      ? user.positionName.trim() || undefined
      : undefined);

  return {
    ...user,
    roleId,
    roleName,
    departmentId,
    departmentName,
    divisionId,
    divisionName,
    positionId,
    positionName,
  } as T & NormalizedFields;
};

export const normalizeUsers = <T extends Partial<User>>(users: T[]): Array<T & NormalizedFields> =>
  users.map((item) => normalizeUser(item));

export default normalizeUser;
