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
  /** ID файла */
  fileId?: string;
  /** Название файла */
  name: string;
  /** Миниатюра */
  thumbnailUrl?: string;
  /** MIME-тип */
  type: string;
  /** URL файла */
  url?: string;
  /** Размер в байтах */
  size?: number;
}

export interface AttachmentPayload {
  /** ID файла */
  fileId: string;
  /** Название файла */
  name: string;
  /** MIME-тип */
  type: string;
}
