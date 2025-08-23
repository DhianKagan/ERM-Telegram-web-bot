// Назначение файла: унифицированный вывод данных пользователя в API
// Основные модули: отсутствуют
import type { User } from 'shared';

export type UserLike = Partial<User> & {
  telegram_username?: string | null;
  toObject?: () => UserLike;
};

export default function formatUser(user: UserLike | null): UserLike | null {
  if (!user) return null;
  const obj: UserLike = user.toObject ? user.toObject() : { ...user };
  obj.telegram_username = obj.username;
  obj.username = String(obj.telegram_id ?? '');
  return obj;
}
