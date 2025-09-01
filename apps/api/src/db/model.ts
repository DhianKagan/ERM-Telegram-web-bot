// Модели MongoDB. Подключение выполняет модуль connection.ts
// Основные модули: mongoose, slugify, connection
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import slugify from 'slugify';
import connect from './connection';

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
  transport_type?: 'Пешком' | 'Авто' | 'Дрон';
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
      enum: ['Пешком', 'Авто', 'Дрон'],
      default: 'Авто',
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
      default: 'Карта',
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

export interface HistoryEntry {
  changed_at: Date;
  changes: Record<string, unknown>;
}

const historySchema = new Schema<HistoryEntry>(
  {
    changed_at: { type: Date, default: Date.now },
    changes: Schema.Types.Mixed,
  },
  { _id: false },
);

export interface TaskAttrs {
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
  task_type?: 'Доставить' | 'Купить' | 'Выполнить' | 'Построить' | 'Починить';
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
  priority?: 'Срочно' | 'В течение дня' | 'Бессрочно';
  priority_id?: number;
  created_by?: number;
  comments?: Comment[];
  status?: 'Новая' | 'В работе' | 'Выполнена' | 'Отменена';
  completed_at?: Date;
  completion_result?: 'full' | 'partial' | 'changed';
  cancel_reason?: 'technical' | 'canceled' | 'declined';
  checklist?: ChecklistItem[];
  comment?: string;
  files?: string[];
  attachments?: Attachment[];
  transport_type?: 'Пешком' | 'Авто' | 'Дрон';
  payment_method?: 'Наличные' | 'Карта' | 'Безнал' | 'Без оплаты';
  telegram_topic_id?: number;
  time_spent?: number;
  // Произвольные поля задачи
  custom?: Record<string, unknown>;
  history?: HistoryEntry[];
}

export interface TaskDocument extends TaskAttrs, Document {}

const taskSchema = new Schema<TaskDocument>(
  {
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
    // Тип задачи пополнился вариантами строительства и ремонта
    task_type: {
      type: String,
      enum: ['Доставить', 'Купить', 'Выполнить', 'Построить', 'Починить'],
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
      enum: ['Срочно', 'В течение дня', 'Бессрочно'],
      default: 'В течение дня',
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
    attachments: [
      {
        name: String,
        url: String,
        thumbnailUrl: String,
        uploadedBy: Number,
        uploadedAt: Date,
        type: String,
        size: Number,
      },
    ],
    transport_type: {
      type: String,
      enum: ['Пешком', 'Авто', 'Дрон'],
      default: 'Авто',
    },

    // Способ оплаты допускает отсутствие оплаты
    payment_method: {
      type: String,
      enum: ['Наличные', 'Карта', 'Безнал', 'Без оплаты'],
      default: 'Карта',
    },

    telegram_topic_id: Number,
    time_spent: { type: Number, default: 0 },
    // Произвольные поля хранятся как объект
    custom: Schema.Types.Mixed,
    history: [historySchema],
  },
  { timestamps: true },
);

taskSchema.pre<TaskDocument>('save', async function (this: TaskDocument) {
  if (!this.request_id) {
    const count = await (
      this.constructor as unknown as Model<TaskDocument>
    ).countDocuments();
    const num = String(count + 1).padStart(6, '0');
    this.request_id = `ERM_${num}`;
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

export interface UserAttrs {
  telegram_id: number;
  username?: string;
  name?: string;
  phone?: string;
  mobNumber?: string;
  email: string;
  role?: 'user' | 'admin';
  access: number;
  roleId?: Types.ObjectId;
  receive_reminders?: boolean;
  verified_at?: Date;
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
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  // Маска доступа: 1 - пользователь, 2 - администратор
  access: { type: Number, default: 1 },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
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

export const Task: Model<TaskDocument> = mongoose.model<TaskDocument>(
  'Task',
  taskSchema,
);
// Отдельная коллекция для архивных задач
export const Archive: Model<TaskDocument> = mongoose.model<TaskDocument>(
  'Archive',
  taskSchema,
  'archives',
);
export const Role: Model<RoleDocument> = mongoose.model<RoleDocument>(
  'Role',
  roleSchema,
);
// Коллекция пользователей бота отличается от AuthUser и хранится отдельно
// Название коллекции меняем на `telegram_users`, чтобы избежать конфликтов
// с историческими индексами, которые могли остаться в `users`
export const User: Model<UserDocument> = mongoose.model<UserDocument>(
  'User',
  userSchema,
  'telegram_users',
);
export const Log: Model<LogDocument> = mongoose.model<LogDocument>(
  'Log',
  logSchema,
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
}

export interface FileDocument extends FileAttrs, Document {}

const fileSchema = new Schema<FileDocument>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  userId: { type: Number, required: true },
  name: { type: String, required: true },
  path: { type: String, required: true },
  thumbnailPath: String,
  type: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

export const File: Model<FileDocument> = mongoose.model<FileDocument>(
  'File',
  fileSchema,
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

export const TaskTemplate: Model<TaskTemplateDocument> =
  mongoose.model<TaskTemplateDocument>('TaskTemplate', taskTemplateSchema);
