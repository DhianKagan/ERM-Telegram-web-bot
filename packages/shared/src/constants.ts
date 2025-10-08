// Назначение: общие константы для задач и пользователей.
// Модули: отсутствуют

export const TASK_TYPES = [
  'Доставить',
  'Купить',
  'Выполнить',
  'Построить',
  'Починить',
  'Заявка',
] as const;

export const PRIORITIES = ['Срочно', 'В течение дня', 'До выполнения'] as const;

export const TRANSPORT_TYPES = [
  'Без транспорта',
  'Легковой',
  'Грузовой',
] as const;

export const PAYMENT_METHODS = [
  'Наличные',
  'Карта',
  'Безнал',
  'Без оплаты',
] as const;

export const TASK_STATUSES = [
  'Новая',
  'В работе',
  'Выполнена',
  'Отменена',
] as const;

export const PROJECT_TIMEZONE = 'Europe/Kyiv';
export const PROJECT_TIMEZONE_LABEL = 'GMT+3';
