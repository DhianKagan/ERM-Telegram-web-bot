// Назначение файла: унифицированный вывод данных пользователя в API
// Основные модули: отсутствуют
import type { User } from 'shared';
import type { Types } from 'mongoose';

export interface UserLike
  extends Omit<
    Partial<User>,
    'roleId' | 'departmentId' | 'divisionId' | 'positionId'
  > {
  telegram_username?: string | null;
  roleId?: string | Types.ObjectId;
  departmentId?: string | Types.ObjectId;
  divisionId?: string | Types.ObjectId;
  positionId?: string | Types.ObjectId;
  toObject?: () => UserLike;
}

export default function formatUser(user: UserLike | null): UserLike | null {
  if (!user) return null;
  const obj = (user.toObject ? user.toObject() : { ...user }) as UserLike & {
    password_hash?: string;
  };
  obj.telegram_username = obj.username;
  obj.username = String(obj.telegram_id ?? '');
  delete obj.password_hash;
  if (obj.roleId) obj.roleId = String(obj.roleId);
  if (obj.departmentId) obj.departmentId = String(obj.departmentId);
  if (obj.divisionId) obj.divisionId = String(obj.divisionId);
  if (obj.positionId) obj.positionId = String(obj.positionId);
  return obj;
}
