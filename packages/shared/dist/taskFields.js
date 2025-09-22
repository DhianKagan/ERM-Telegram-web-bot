"use strict";
// Назначение файла: общие поля формы задачи для бота и веб-клиента
// Модули: constants
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskFields = void 0;
const constants_1 = require("./constants");
exports.taskFields = [
    { name: 'title', label: 'Название', type: 'text', required: true },
    {
        name: 'task_type',
        label: 'Тип',
        type: 'select',
        options: constants_1.TASK_TYPES,
        default: constants_1.TASK_TYPES[0],
    },
    {
        name: 'priority',
        label: 'Приоритет',
        type: 'select',
        options: constants_1.PRIORITIES,
        default: constants_1.PRIORITIES[1],
    },
    { name: 'creator', label: 'Задачу создал', type: 'select' },
    { name: 'assignees', label: 'Исполнители', type: 'multiselect' },
    { name: 'start_location', label: 'Старт точка', type: 'location' },
    {
        name: 'transport_type',
        label: 'Тип транспорта',
        type: 'select',
        options: constants_1.TRANSPORT_TYPES,
        default: constants_1.TRANSPORT_TYPES[1],
    },
    { name: 'cargo_length_m', label: 'Длина, м', type: 'number' },
    { name: 'cargo_width_m', label: 'Ширина, м', type: 'number' },
    { name: 'cargo_height_m', label: 'Высота, м', type: 'number' },
    { name: 'cargo_volume_m3', label: 'Объём, м³', type: 'number' },
    { name: 'cargo_weight_kg', label: 'Вес, кг', type: 'number' },
    { name: 'end_location', label: 'Финальная точка', type: 'location' },
    {
        name: 'payment_method',
        label: 'Способ оплаты',
        type: 'select',
        options: constants_1.PAYMENT_METHODS,
        default: constants_1.PAYMENT_METHODS[1],
    },
    {
        name: 'status',
        label: 'Статус',
        type: 'select',
        options: constants_1.TASK_STATUSES,
        default: constants_1.TASK_STATUSES[0],
    },
    { name: 'description', label: '🔨 Задача', type: 'richtext' },
    { name: 'comment', label: 'Комментарий', type: 'richtext' },
];
exports.default = exports.taskFields;
