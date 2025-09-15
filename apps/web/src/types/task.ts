// Назначение: типы задач фронтенда
// Модули: отсутствуют

export interface HistoryItem {
  /** Время изменения */
  changed_at: string;
  /** Кто изменил */
  changed_by: number;
  /** Состояния до и после */
  changes: {
    from: Record<string, unknown>;
    to: Record<string, unknown>;
  };
}

export interface UserBrief {
  /** Telegram ID пользователя */
  telegram_id: number;
  /** Имя пользователя */
  name?: string;
  /** Ник в Telegram */
  telegram_username?: string | null;
  /** Логин */
  username?: string;
}

export interface Attachment {
  /** Название файла */
  name: string;
  /** URL файла */
  url: string;
  /** Миниатюра */
  thumbnailUrl?: string;
  /** MIME-тип */
  type: string;
  /** Размер в байтах */
  size: number;
}
