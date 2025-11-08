import mongoose, { Document, Types } from 'mongoose';
export interface ChecklistItem {
    text?: string;
    done?: boolean;
}
export interface Applicant {
    name?: string;
    phone?: string;
    email?: string;
}
export interface Logistics {
    start_location?: string;
    end_location?: string;
    start_date?: Date;
    end_date?: Date;
    transport?: string;
    transport_type?: 'Без транспорта' | 'Легковой' | 'Грузовой';
}
export interface Item {
    name?: string;
    quantity?: number;
    cost?: number;
}
export interface Procurement {
    items?: Item[];
    vendor?: string;
    total_cost?: number;
    payment_method?: 'Наличные' | 'Карта' | 'Безнал' | 'Без оплаты';
}
export interface Work {
    description?: string;
    deadline?: Date;
    performers?: number[];
}
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
    changed_by: number;
    changes: {
        from: Record<string, unknown>;
        to: Record<string, unknown>;
    };
}
export interface TaskHistoryArchiveEntry {
    taskId: Types.ObjectId;
    entries: HistoryEntry[];
    createdAt?: Date;
    createdBy?: number;
    reason?: string;
}
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
    task_type?: 'Доставить' | 'Купить' | 'Выполнить' | 'Построить' | 'Починить' | 'Заявка';
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
    route_distance_km?: number | null;
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
    transport_driver_name?: string | null;
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
    telegram_status_message_id?: number;
    telegram_history_message_id?: number;
    telegram_summary_message_id?: number;
    telegram_preview_message_ids?: number[];
    telegram_attachments_message_ids?: number[];
    telegram_dm_message_ids?: {
        user_id: number;
        message_id: number;
    }[];
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
    custom?: Record<string, unknown>;
    history?: HistoryEntry[];
    history_overflow_count?: number;
    archived_at?: Date;
    archived_by?: number;
}
export interface TaskDocument extends TaskAttrs, Document {
}
export interface RoleAttrs {
    name?: string;
    permissions?: (string | number)[];
}
export interface RoleDocument extends RoleAttrs, Document {
}
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
    is_bot?: boolean;
}
export interface UserDocument extends UserAttrs, Document {
}
export interface LogAttrs {
    message?: string;
    level?: 'debug' | 'info' | 'warn' | 'error' | 'log';
}
export interface LogDocument extends LogAttrs, Document {
}
export declare const Task: mongoose.Model<TaskDocument, {}, {}, {}, mongoose.Document<unknown, {}, TaskDocument, {}, {}> & TaskDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export interface TaskHistoryArchiveDocument extends TaskHistoryArchiveEntry, Document {
}
export declare const TaskHistoryArchive: mongoose.Model<TaskHistoryArchiveDocument, {}, {}, {}, mongoose.Document<unknown, {}, TaskHistoryArchiveDocument, {}, {}> & TaskHistoryArchiveDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const Archive: mongoose.Model<TaskDocument, {}, {}, {}, mongoose.Document<unknown, {}, TaskDocument, {}, {}> & TaskDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const Role: mongoose.Model<RoleDocument, {}, {}, {}, mongoose.Document<unknown, {}, RoleDocument, {}, {}> & RoleDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const User: mongoose.Model<UserDocument, {}, {}, {}, mongoose.Document<unknown, {}, UserDocument, {}, {}> & UserDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export declare const Log: mongoose.Model<LogDocument, {}, {}, {}, mongoose.Document<unknown, {}, LogDocument, {}, {}> & LogDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export interface ShortLinkAttrs {
    slug: string;
    url: string;
    access_count?: number;
    last_accessed_at?: Date;
    created_at?: Date;
    updated_at?: Date;
}
export interface ShortLinkDocument extends ShortLinkAttrs, Document {
}
export declare const ShortLink: mongoose.Model<ShortLinkDocument, {}, {}, {}, mongoose.Document<unknown, {}, ShortLinkDocument, {}, {}> & ShortLinkDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
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
export interface FileDocument extends FileAttrs, Document {
}
export declare const File: mongoose.Model<FileDocument, {}, {}, {}, mongoose.Document<unknown, {}, FileDocument, {}, {}> & FileDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export interface TaskDraftAttrs {
    userId: number;
    kind: 'task' | 'request';
    payload: Record<string, unknown>;
    attachments?: Attachment[];
}
export interface TaskDraftDocument extends TaskDraftAttrs, Document {
}
export declare const TaskDraft: mongoose.Model<TaskDraftDocument, {}, {}, {}, mongoose.Document<unknown, {}, TaskDraftDocument, {}, {}> & TaskDraftDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export interface TaskTemplateAttrs {
    name: string;
    data: Record<string, unknown>;
}
export interface TaskTemplateDocument extends TaskTemplateAttrs, Document {
}
export declare const TaskTemplate: mongoose.Model<TaskTemplateDocument, {}, {}, {}, mongoose.Document<unknown, {}, TaskTemplateDocument, {}, {}> & TaskTemplateDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
