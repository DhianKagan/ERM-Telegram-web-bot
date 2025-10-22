// Модели MongoDB. Подключение выполняет модуль connection.ts
// Основные модули: mongoose, slugify, connection
import mongoose, { Schema, Document, Types } from 'mongoose';
import slugify from 'slugify';
import connect from './connection';

const normalizePriorityValue = (value?: string | null) => {
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
  connect().catch((e: unknown) => {
    const err = e as { message?: string };
    console.error('Не удалось подключиться к MongoDB:', err.message);
    process.exit(1);
  });
}

export interface ChecklistItem {
  text?: string;
  done?: boolean;
}

const checklistItemSchema = new Schema<ChecklistItem>(
  {
    text: String,
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface Applicant {
  name?: string;
  phone?: string;
  email?: string;
}

const applicantSchema = new Schema<Applicant>(
  {
    name: String,
    phone: String,
    email: String,
  },
  { _id: false },
);

export interface Logistics {
  start_location?: string;
  end_location?: string;
  start_date?: Date;
  end_date?: Date;
  transport?: string;
  transport_type?: 'Без транспорта' | 'Легковой' | 'Грузовой';
}

const logisticsSchema = new Schema<Logistics>(
  {
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
  },
  { _id: false },
);

export interface Item {
  name?: string;
  quantity?: number;
  cost?: number;
}

const itemSchema = new Schema<Item>(
  {
    name: String,
    quantity: Number,
    cost: Number,
  },
  { _id: false },
);

export interface Procurement {
  items?: Item[];
  vendor?: string;
  total_cost?: number;
  payment_method?: 'Наличные' | 'Карта' | 'Безнал' | 'Без оплаты';
}

const procurementSchema = new Schema<Procurement>(
  {
    items: [itemSchema],
    vendor: String,
    total_cost: Number,
    payment_method: {
      type: String,
      enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
      default: 'Без оплаты',
    },
  },
  { _id: false },
);

export interface Work {
  description?: string;
  deadline?: Date;
  performers?: number[];
}

const workSchema = new Schema<Work>(
  {
    description: String,
    deadline: Date,
    performers: [Number],
  },
  { _id: false },
);

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Comment {
  author_id: number;
  text: string;
  created_at?: Date;
}

export interface Attachment {
  name: string;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: number;
  uploadedAt: Date;
  type: string;
  size: number;
}

const attachmentSchema = new Schema<Attachment>(
  {
    name: String,
    url: String,
    thumbnailUrl: String,
    uploadedBy: Number,
    uploadedAt: Date,
    type: String,
    size: Number,
  },
  { _id: false },
);

export interface HistoryEntry {
  changed_at: Date;
  changed_by: number;
  changes: {
    from: Record<string, unknown>;
    to: Record<string, unknown>;
  };
}

const historySchema = new Schema<HistoryEntry>(
  {
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: Number, required: true },
    changes: {
      from: Schema.Types.Mixed,
      to: Schema.Types.Mixed,
    },
  },
  { _id: false },
);

export type TaskKind = 'task' | 'request';

export interface TaskAttrs {
  kind?: TaskKind;
  request_id?: string;
  task_number?: string;
  submission_date?: Date;
  applicant?: Applicant;
  logistics_details?: Logistics;
  procurement_details?: Procurement;
  work_details?: Work;
  title: string;
  slug?: string;
  task_description?: string;
  task_type?:
    | 'Доставить'
    | 'Купить'
    | 'Выполнить'
    | 'Построить'
    | 'Починить'
    | 'Заявка';
  task_type_id?: number;
  start_date?: Date;
  due_date?: Date;
  remind_at?: Date;
  location?: string;
  start_location?: string;
  start_location_link?: string;
  startCoordinates?: Coordinates;
  end_location?: string;
  end_location_link?: string;
  finishCoordinates?: Coordinates;
  google_route_url?: string;
  route_distance_km?: number;
  route_nodes?: number[];
  assigned_user_id?: number;
  controller_user_id?: number;
  controllers?: number[];
  assignees?: number[];
  project?: string;
  priority?: 'Срочно' | 'В течение дня' | 'До выполнения';
  priority_id?: number;
  created_by?: number;
  comments?: Comment[];
  status?: 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';
  completed_at?: Date | null;
  in_progress_at?: Date | null;
  completion_result?: 'full' | 'partial' | 'changed';
  cancel_reason?: 'technical' | 'canceled' | 'declined';
  checklist?: ChecklistItem[];
  comment?: string;
  files?: string[];
  attachments?: Attachment[];
  transport_type?: 'Без транспорта' | 'Легковой' | 'Грузовой';
  transport_driver_id?: number | null;
  transport_vehicle_id?: Types.ObjectId | null;
  transport_vehicle_name?: string | null;
  transport_vehicle_registration?: string | null;
  cargo_length_m?: number;
  cargo_width_m?: number;
  cargo_height_m?: number;
  cargo_volume_m3?: number;
  cargo_weight_kg?: number;
  logistics_enabled?: boolean;
  payment_method?: 'Наличные' | 'Карта' | 'Безнал' | 'Без оплаты';
  payment_amount?: number;
  telegram_topic_id?: number;
  telegram_message_id?: number;
  // Устаревшее поле, сохраняем для совместимости миграции
  telegram_status_message_id?: number;
  // Сообщение с подробной историей задачи
  telegram_history_message_id?: number;
  // Краткое сводное сообщение по задаче
  telegram_summary_message_id?: number;
  telegram_preview_message_ids?: number[];
  telegram_attachments_message_ids?: number[];
  telegram_dm_message_ids?: { user_id: number; message_id: number }[];
  telegram_photos_message_id?: number;
  telegram_photos_chat_id?: string | number;
  telegram_photos_topic_id?: number;
  telegram_comment_message_id?: number;
  telegram_message_cleanup?: {
    chat_id: string | number;
    message_id: number;
    topic_id?: number;
    attempted_topic_id?: number;
    new_message_id?: number;
    reason?: string;
    attempted_at?: Date | string;
  };
  deadline_reminder_sent_at?: Date;
  time_spent?: number;
  // Произвольные поля задачи
  custom?: Record<string, unknown>;
  history?: HistoryEntry[];
  archived_at?: Date;
  archived_by?: number;
}

export interface TaskDocument extends TaskAttrs, Document {}

const taskSchema = new Schema<TaskDocument>(
  {
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
    transport_vehicle_id: { type: Schema.Types.ObjectId, ref: 'Fleet' },
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
    telegram_message_cleanup: Schema.Types.Mixed,
    deadline_reminder_sent_at: Date,
    time_spent: { type: Number, default: 0 },
    // Произвольные поля хранятся как объект
    custom: Schema.Types.Mixed,
    history: [historySchema],
    archived_at: Date,
    archived_by: Number,
  },
  { timestamps: true },
);

taskSchema.pre('init', (doc: Record<string, unknown>) => {
  if (doc && typeof doc.priority === 'string') {
    const normalized = normalizePriorityValue(doc.priority);
    if (normalized) {
      doc.priority = normalized;
    }
  }
});

taskSchema.pre<TaskDocument>('save', async function (this: TaskDocument) {
  const normalizedKind = this.kind === 'request' ? 'request' : 'task';
  this.kind = normalizedKind;
  const prefix = normalizedKind === 'request' ? 'REQ' : 'ERM';
  if (!this.request_id) {
    const taskModel = mongoose.model<TaskDocument>('Task');
    const requestIdPattern = new RegExp(`^${prefix}_\\d+$`);
    const [stats] = await taskModel.aggregate<{ max: number }>([
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
  this.slug = slugify(this.title, { lower: true, strict: true });
});

export interface RoleAttrs {
  name?: string;
  permissions?: (string | number)[];
}

export interface RoleDocument extends RoleAttrs, Document {}

const roleSchema = new Schema<RoleDocument>({
  name: String,
  permissions: [String],
});
roleSchema.index({ name: 1 }, { name: 'role_name_unique', unique: true });

export interface UserAttrs {
  telegram_id: number;
  username?: string;
  name?: string;
  phone?: string;
  mobNumber?: string;
  email: string;
  role?: 'user' | 'admin' | 'manager';
  access: number;
  roleId?: Types.ObjectId;
  receive_reminders?: boolean;
  verified_at?: Date;
  departmentId?: Types.ObjectId;
  divisionId?: Types.ObjectId;
  positionId?: Types.ObjectId;
}

export interface UserDocument extends UserAttrs, Document {}

const userSchema = new Schema<UserDocument>({
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
  roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'CollectionItem' },
  divisionId: { type: Schema.Types.ObjectId, ref: 'CollectionItem' },
  positionId: { type: Schema.Types.ObjectId, ref: 'CollectionItem' },
  // Настройка получения напоминаний планировщиком
  receive_reminders: { type: Boolean, default: true },
  // Дата прохождения верификации через Bot API
  verified_at: Date,
});

export interface LogAttrs {
  message?: string;
  // уровень логирования; console.log сохраняет уровень `log`
  level?: 'debug' | 'info' | 'warn' | 'error' | 'log';
}

export interface LogDocument extends LogAttrs, Document {}

const logSchema = new Schema<LogDocument>(
  {
    message: String,
    // уровень логирования; console.log сохраняет уровень `log`
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error', 'log'],
      default: 'info',
    },
  },
  { timestamps: true },
);

export const Task = mongoose.model<TaskDocument>('Task', taskSchema);
// Отдельная коллекция для архивных задач
export const Archive = mongoose.model<TaskDocument>('Archive', taskSchema, 'archives');
export const Role = mongoose.model<RoleDocument>('Role', roleSchema);
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
export const User = mongoose.model<UserDocument>('User', userSchema, 'telegram_users');
export const Log = mongoose.model<LogDocument>('Log', logSchema);

export interface ShortLinkAttrs {
  slug: string;
  url: string;
  access_count?: number;
  last_accessed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShortLinkDocument extends ShortLinkAttrs, Document {}

const shortLinkSchema = new Schema<ShortLinkDocument>(
  {
    slug: { type: String, required: true, unique: true },
    url: { type: String, required: true, unique: true },
    access_count: { type: Number, default: 0 },
    last_accessed_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

shortLinkSchema.index({ slug: 1 }, { unique: true, name: 'short_link_slug_unique' });
shortLinkSchema.index({ url: 1 }, { unique: true, name: 'short_link_url_unique' });

export const ShortLink = mongoose.model<ShortLinkDocument>(
  'ShortLink',
  shortLinkSchema,
);

// Коллекция загруженных файлов
// Основные модули: mongoose
export interface FileAttrs {
  taskId?: Types.ObjectId;
  userId: number;
  name: string;
  path: string;
  thumbnailPath?: string;
  type: string;
  size: number;
  uploadedAt: Date;
  draftId?: Types.ObjectId;
}

export interface FileDocument extends FileAttrs, Document {}

const fileSchema = new Schema<FileDocument>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  draftId: { type: Schema.Types.ObjectId, ref: 'TaskDraft', default: null },
  userId: { type: Number, required: true },
  name: { type: String, required: true },
  path: { type: String, required: true },
  thumbnailPath: String,
  type: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

fileSchema.index({ draftId: 1 }, { name: 'files_draft_id_idx' });

export const File = mongoose.model<FileDocument>('File', fileSchema);

// Черновики задач сохраняют незавершённые формы
// Основные модули: mongoose
export interface TaskDraftAttrs {
  userId: number;
  kind: 'task' | 'request';
  payload: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface TaskDraftDocument extends TaskDraftAttrs, Document {}

const taskDraftSchema = new Schema<TaskDraftDocument>(
  {
    userId: { type: Number, required: true },
    kind: { type: String, enum: ['task', 'request'], required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    attachments: [attachmentSchema],
  },
  { timestamps: true },
);

taskDraftSchema.index(
  { userId: 1, kind: 1 },
  { unique: true, name: 'task_drafts_user_kind_unique' },
);

export const TaskDraft = mongoose.model<TaskDraftDocument>(
  'TaskDraft',
  taskDraftSchema,
);

// Шаблон задачи хранит предустановленные поля
// Основные модули: mongoose
export interface TaskTemplateAttrs {
  name: string;
  data: Record<string, unknown>;
}

export interface TaskTemplateDocument extends TaskTemplateAttrs, Document {}

const taskTemplateSchema = new Schema<TaskTemplateDocument>(
  {
    name: { type: String, required: true },
    data: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const TaskTemplate = mongoose.model<TaskTemplateDocument>(
  'TaskTemplate',
  taskTemplateSchema,
);
