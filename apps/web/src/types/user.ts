// Назначение: тип пользователя фронтенда
// Модули: отсутствуют

export interface User {
  /** Строковый идентификатор пользователя */
  id: string;
  /** Telegram ID */
  telegram_id?: number;
  /** Имя пользователя в Telegram */
  telegram_username?: string | null;
  /** Логин пользователя, совпадает с Telegram ID */
  username?: string;
  /** Отображаемое имя */
  name?: string;
  /** Основной телефон */
  phone?: string;
  /** Мобильный номер */
  mobNumber?: string;
  /** Электронная почта */
  email?: string;
  /** Роль пользователя */
  role?: string;
  /** Уровень доступа */
  access?: number;
  /** Список разрешений пользователя */
  permissions?: string[];
  /** Идентификатор роли */
  roleId?: string;
  /** Идентификатор департамента */
  departmentId?: string;
  /** Идентификатор отдела */
  divisionId?: string;
  /** Идентификатор должности */
  positionId?: string;
}
