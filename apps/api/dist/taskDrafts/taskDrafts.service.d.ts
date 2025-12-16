import { type TaskDraftDocument } from '../db/model';
export default class TaskDraftsService {
    getDraft(userId: number, kind: 'task' | 'request'): Promise<TaskDraftDocument | null>;
    /**
     * Нормализует полезную нагрузку черновика:
     * - attachments: приводит к массиву Attachment
     * - startCoordinates / finishCoordinates: приводит к {lat,lng} или удаляет
     * - route_distance_km: если не число, приводит к null
     * - сохраняет прочие поля как есть
     */
    private normalizePayload;
    saveDraft(userId: number, kind: 'task' | 'request', payload: unknown): Promise<TaskDraftDocument>;
    deleteDraft(userId: number, kind: 'task' | 'request'): Promise<void>;
}
