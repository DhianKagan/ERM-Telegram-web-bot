'use strict';
// Назначение: общие константы для задач и пользователей.
// Модули: отсутствуют
Object.defineProperty(exports, '__esModule', { value: true });
exports.PROJECT_TIMEZONE_LABEL =
  exports.PROJECT_TIMEZONE =
  exports.TASK_STATUSES =
  exports.PAYMENT_METHODS =
  exports.TRANSPORT_TYPES =
  exports.PRIORITIES =
  exports.TASK_TYPES =
    void 0;
exports.TASK_TYPES = [
  'Доставить',
  'Купить',
  'Выполнить',
  'Построить',
  'Починить',
  'Заявка',
];
exports.PRIORITIES = ['Срочно', 'В течение дня', 'До выполнения'];
exports.TRANSPORT_TYPES = ['Без транспорта', 'Легковой', 'Грузовой'];
exports.PAYMENT_METHODS = ['Наличные', 'Карта', 'Безнал', 'Без оплаты'];
exports.TASK_STATUSES = ['Новая', 'В работе', 'Выполнена', 'Отменена'];
exports.PROJECT_TIMEZONE = 'Europe/Kyiv';
exports.PROJECT_TIMEZONE_LABEL = 'GMT+3';
