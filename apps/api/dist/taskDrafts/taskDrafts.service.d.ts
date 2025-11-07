import { type TaskDraftDocument } from '../db/model';
export default class TaskDraftsService {
    getDraft(userId: number, kind: 'task' | 'request'): Promise<TaskDraftDocument | null>;
    saveDraft(userId: number, kind: 'task' | 'request', payload: unknown): Promise<TaskDraftDocument>;
    deleteDraft(userId: number, kind: 'task' | 'request'): Promise<void>;
}
