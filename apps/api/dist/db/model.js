"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskTemplate = exports.TaskDraft = exports.File = exports.ShortLink = exports.Log = exports.User = exports.Role = exports.Archive = exports.TaskHistoryArchive = exports.Task = void 0;
// Модели MongoDB. Подключение выполняет модуль connection.ts
// Основные модули: mongoose, slugify, connection
const mongoose_1 = __importStar(require("mongoose"));
const slugify_1 = __importDefault(require("slugify"));
const connection_1 = __importDefault(require("./connection"));
const normalizePriorityValue = (value) => {
    if (typeof value !== 'string') {
        return value ?? undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    return /^бессроч/i.test(trimmed) ? 'До выполнения' : trimmed;
};
if (process.env.NODE_ENV !== 'test') {
    (0, connection_1.default)().catch((e) => {
        const err = e;
        console.error('Не удалось подключиться к MongoDB:', err.message);
        process.exit(1);
    });
}
const checklistItemSchema = new mongoose_1.Schema({
    text: String,
    done: { type: Boolean, default: false },
}, { _id: false });
const applicantSchema = new mongoose_1.Schema({
    name: String,
    phone: String,
    email: String,
}, { _id: false });
const logisticsSchema = new mongoose_1.Schema({
    start_location: String,
    end_location: String,
    start_date: Date,
    end_date: Date,
    transport: String,
    transport_type: {
        type: String,
        enum: ['Без транспорта', 'Легковой', 'Грузовой'],
        default: 'Без транспорта',
    },
}, { _id: false });
const itemSchema = new mongoose_1.Schema({
    name: String,
    quantity: Number,
    cost: Number,
}, { _id: false });
const procurementSchema = new mongoose_1.Schema({
    items: [itemSchema],
    vendor: String,
    total_cost: Number,
    payment_method: {
        type: String,
        enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
        default: 'Без оплаты',
    },
}, { _id: false });
const workSchema = new mongoose_1.Schema({
    description: String,
    deadline: Date,
    performers: [Number],
}, { _id: false });
const attachmentSchema = new mongoose_1.Schema({
    name: String,
    url: String,
    thumbnailUrl: String,
    uploadedBy: Number,
    uploadedAt: Date,
    type: String,
    size: Number,
}, { _id: false });
const historySchema = new mongoose_1.Schema({
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: Number, required: true },
    changes: {
        from: mongoose_1.Schema.Types.Mixed,
        to: mongoose_1.Schema.Types.Mixed,
    },
}, { _id: false });
const taskHistoryArchiveSchema = new mongoose_1.Schema({
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task', index: true, required: true },
    entries: { type: [historySchema], required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Number, default: 0 },
    reason: { type: String },
}, { timestamps: false });
const taskSchema = new mongoose_1.Schema({
    kind: {
        type: String,
        enum: ['task', 'request'],
        default: 'task',
    },
    request_id: String,
    task_number: String,
    submission_date: Date,
    applicant: applicantSchema,
    logistics_details: logisticsSchema,
    procurement_details: procurementSchema,
    work_details: workSchema,
    title: { type: String, required: true },
    slug: String,
    task_description: { type: String, maxlength: 4096 },
    // Тип задачи пополнился вариантами строительства, ремонта и заявок
    task_type: {
        type: String,
        enum: ['Доставить', 'Купить', 'Выполнить', 'Построить', 'Починить', 'Заявка'],
    },
    task_type_id: Number,
    start_date: Date,
    due_date: Date,
    remind_at: Date,
    location: String,
    start_location: String,
    start_location_link: String,
    startCoordinates: { lat: Number, lng: Number },
    end_location: String,
    end_location_link: String,
    finishCoordinates: { lat: Number, lng: Number },
    google_route_url: String,
    // Расстояние маршрута в километрах
    route_distance_km: Number,
    // Список узлов маршрута для анализа
    route_nodes: [Number],
    assigned_user_id: Number,
    controller_user_id: Number,
    controllers: [Number],
    assignees: [Number],
    // Принадлежность задачи проекту
    project: String,
    priority: {
        type: String,
        enum: ['Срочно', 'В течение дня', 'До выполнения'],
        default: 'В течение дня',
        set: normalizePriorityValue,
    },
    priority_id: Number,
    created_by: Number,
    comments: [
        {
            author_id: Number,
            text: { type: String, maxlength: 4096 },
            created_at: { type: Date, default: Date.now },
        },
    ],
    status: {
        type: String,
        enum: ['Новая', 'В работе', 'Выполнена', 'Отменена'],
        default: 'Новая',
    },
    completed_at: Date,
    in_progress_at: Date,
    completion_result: {
        type: String,
        enum: ['full', 'partial', 'changed'],
    },
    cancel_reason: {
        type: String,
        enum: ['technical', 'canceled', 'declined'],
    },
    checklist: [checklistItemSchema],
    comment: { type: String, maxlength: 4096 },
    files: [String],
    attachments: [attachmentSchema],
    transport_type: {
        type: String,
        enum: ['Без транспорта', 'Легковой', 'Грузовой'],
        default: 'Без транспорта',
    },
    transport_driver_id: Number,
    transport_driver_name: String,
    transport_vehicle_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Fleet' },
    transport_vehicle_name: String,
    transport_vehicle_registration: String,
    cargo_length_m: Number,
    cargo_width_m: Number,
    cargo_height_m: Number,
    cargo_volume_m3: Number,
    cargo_weight_kg: Number,
    logistics_enabled: { type: Boolean, default: false },
    // Способ оплаты допускает отсутствие оплаты
    payment_method: {
        type: String,
        enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
        default: 'Без оплаты',
    },
    payment_amount: {
        type: Number,
        default: 0,
        min: 0,
    },
    telegram_topic_id: Number,
    telegram_message_id: Number,
    telegram_status_message_id: Number,
    telegram_history_message_id: Number,
    telegram_summary_message_id: Number,
    telegram_preview_message_ids: [Number],
    telegram_attachments_message_ids: [Number],
    telegram_dm_message_ids: [
        {
            user_id: Number,
            message_id: Number,
        },
    ],
    telegram_photos_message_id: Number,
    telegram_photos_chat_id: String,
    telegram_photos_topic_id: Number,
    telegram_comment_message_id: Number,
    telegram_message_cleanup: mongoose_1.Schema.Types.Mixed,
    deadline_reminder_sent_at: Date,
    time_spent: { type: Number, default: 0 },
    // Произвольные поля хранятся как объект
    custom: mongoose_1.Schema.Types.Mixed,
    history: [historySchema],
    history_overflow_count: { type: Number, default: 0 },
    archived_at: Date,
    archived_by: Number,
}, { timestamps: true });
taskSchema.pre('init', (doc) => {
    if (doc && typeof doc.priority === 'string') {
        const normalized = normalizePriorityValue(doc.priority);
        if (normalized) {
            doc.priority = normalized;
        }
    }
});
taskSchema.pre('save', async function () {
    const normalizedKind = this.kind === 'request' ? 'request' : 'task';
    this.kind = normalizedKind;
    const prefix = normalizedKind === 'request' ? 'REQ' : 'ERM';
    if (!this.request_id) {
        const taskModel = mongoose_1.default.model('Task');
        const requestIdPattern = new RegExp(`^${prefix}_\\d+$`);
        const [stats] = await taskModel.aggregate([
            { $match: { request_id: requestIdPattern } },
            {
                $project: {
                    suffix: {
                        $toInt: {
                            $arrayElemAt: [{ $split: ['$request_id', '_'] }, 1],
                        },
                    },
                },
            },
            { $group: { _id: null, max: { $max: '$suffix' } } },
        ]);
        const latestNumber = stats?.max ?? 0;
        const num = String(latestNumber + 1).padStart(6, '0');
        this.request_id = `${prefix}_${num}`;
    }
    this.task_number = this.request_id;
    if (!this.title) {
        this.title = this.request_id;
    }
    this.slug = (0, slugify_1.default)(this.title, { lower: true, strict: true });
});
const roleSchema = new mongoose_1.Schema({
    name: String,
    permissions: [String],
});
roleSchema.index({ name: 1 }, { name: 'role_name_unique', unique: true });
const userSchema = new mongoose_1.Schema({
    telegram_id: Number,
    username: String,
    // Полное имя пользователя для отображения в интерфейсе
    name: String,
    // Номер телефона для связи
    phone: String,
    // Альтернативный номер телефона
    mobNumber: String,
    // Email используется для совместимости со старым индексом в базе.
    // Сохраняем уникальное значение на основе telegram_id.
    email: { type: String, unique: true },
    // Роль пользователя хранится строкой, по умолчанию обычный пользователь
    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },
    // Маска доступа: 1 - пользователь, 2 - администратор, 4 - менеджер
    access: { type: Number, default: 1 },
    roleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Role' },
    departmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CollectionItem' },
    divisionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CollectionItem' },
    positionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CollectionItem' },
    // Настройка получения напоминаний планировщиком
    receive_reminders: { type: Boolean, default: true },
    // Дата прохождения верификации через Bot API
    verified_at: Date,
    // Флаг Telegram-аккаунта бота для отключения личных уведомлений
    is_bot: { type: Boolean, default: false },
});
const logSchema = new mongoose_1.Schema({
    message: String,
    // уровень логирования; console.log сохраняет уровень `log`
    level: {
        type: String,
        enum: ['debug', 'info', 'warn', 'error', 'log'],
        default: 'info',
    },
}, { timestamps: true });
exports.Task = mongoose_1.default.model('Task', taskSchema);
exports.TaskHistoryArchive = mongoose_1.default.model('TaskHistoryArchive', taskHistoryArchiveSchema);
// Отдельная коллекция для архивных задач
exports.Archive = mongoose_1.default.model('Archive', taskSchema, 'archives');
exports.Role = mongoose_1.default.model('Role', roleSchema);
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
exports.User = mongoose_1.default.model('User', userSchema, 'telegram_users');
exports.Log = mongoose_1.default.model('Log', logSchema);
const shortLinkSchema = new mongoose_1.Schema({
    slug: { type: String, required: true, unique: true },
    url: { type: String, required: true, unique: true },
    access_count: { type: Number, default: 0 },
    last_accessed_at: Date,
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
shortLinkSchema.index({ slug: 1 }, { unique: true, name: 'short_link_slug_unique' });
shortLinkSchema.index({ url: 1 }, { unique: true, name: 'short_link_url_unique' });
exports.ShortLink = mongoose_1.default.model('ShortLink', shortLinkSchema);
const fileSchema = new mongoose_1.Schema({
    taskId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Task' },
    draftId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TaskDraft', default: null },
    userId: { type: Number, required: true },
    name: { type: String, required: true },
    path: { type: String, required: true },
    thumbnailPath: String,
    type: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
});
fileSchema.index({ draftId: 1 }, { name: 'files_draft_id_idx' });
exports.File = mongoose_1.default.model('File', fileSchema);
const taskDraftSchema = new mongoose_1.Schema({
    userId: { type: Number, required: true },
    kind: { type: String, enum: ['task', 'request'], required: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    attachments: [attachmentSchema],
}, { timestamps: true });
taskDraftSchema.index({ userId: 1, kind: 1 }, { unique: true, name: 'task_drafts_user_kind_unique' });
exports.TaskDraft = mongoose_1.default.model('TaskDraft', taskDraftSchema);
const taskTemplateSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    data: mongoose_1.Schema.Types.Mixed,
}, { timestamps: true });
exports.TaskTemplate = mongoose_1.default.model('TaskTemplate', taskTemplateSchema);
