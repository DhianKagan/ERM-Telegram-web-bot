import type { ArchiveListParams } from '../db/queries';
import type { TaskAttrs } from '../db/model';
import type { Types } from 'mongoose';
type LeanArchiveTask = (TaskAttrs & {
    _id: Types.ObjectId;
    archived_at?: Date;
    archived_by?: number;
    createdAt?: Date;
    updatedAt?: Date;
}) & Record<string, unknown>;
interface ArchivesRepository {
    listArchivedTasks(params: ArchiveListParams): Promise<{
        items: LeanArchiveTask[];
        total: number;
        page: number;
        pages: number;
    }>;
    purgeArchivedTasks(ids: string[]): Promise<number>;
}
declare class ArchivesService {
    private repo;
    constructor(repo: ArchivesRepository);
    list(params: ArchiveListParams): Promise<{
        items: LeanArchiveTask[];
        total: number;
        page: number;
        pages: number;
    }>;
    purge(ids: string[]): Promise<number>;
}
export default ArchivesService;
