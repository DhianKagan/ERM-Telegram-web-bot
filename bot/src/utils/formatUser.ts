// Назначение файла: унифицированный вывод данных пользователя в API
// Основные модули: отсутствуют
export interface UserLike {
  telegram_id?: number | string | null;
  username?: string | null;
  telegram_username?: string | null;
  toObject?: () => UserLike;
}

export default function formatUser(user: UserLike | null): UserLike | null {
  if (!user) return null;
  const obj: UserLike = user.toObject ? user.toObject() : { ...user };
  obj.telegram_username = obj.username;
  obj.username = String(obj.telegram_id ?? '');
  return obj;
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = formatUser;
