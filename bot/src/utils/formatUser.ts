// Назначение файла: унифицированный вывод данных пользователя в API
// Основные модули: отсутствуют
export interface UserLike {
  telegram_id: number | string;
  username?: string;
  telegram_username?: string;
  toObject?: () => UserLike;
  [key: string]: unknown;
}

export default function formatUser(user: UserLike | null): UserLike | null {
  if (!user) return null;
  const obj: UserLike = user.toObject ? user.toObject() : { ...user };
  obj.telegram_username = obj.username;
  obj.username = String(obj.telegram_id);
  return obj;
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = formatUser;
