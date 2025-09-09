// Назначение файла: унифицированный вывод данных пользователя в API
// Основные модули: отсутствуют
import type { User } from 'shared';

export type UserLike = Partial<
  Omit<User, 'roleId' | 'departmentId' | 'divisionId' | 'positionId'>
> & {
  roleId?: unknown;
  departmentId?: unknown;
  divisionId?: unknown;
  positionId?: unknown;
  telegram_username?: string | null;
  toObject?: () => UserLike;
};

export default function formatUser(user: UserLike | null): UserLike | null {
  if (!user) return null;
  const obj: UserLike = user.toObject ? user.toObject() : { ...user };
  obj.telegram_username = obj.username;
  obj.username = String(obj.telegram_id ?? '');
  if ((obj as any).roleId) (obj as any).roleId = String((obj as any).roleId);
  if ((obj as any).departmentId)
    (obj as any).departmentId = String((obj as any).departmentId);
  if ((obj as any).divisionId)
    (obj as any).divisionId = String((obj as any).divisionId);
  if ((obj as any).positionId)
    (obj as any).positionId = String((obj as any).positionId);
  return obj;
}
