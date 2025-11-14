// Сервис архива задач через репозиторий
// Основные модули: db/queries
import type { ArchiveListParams } from '../db/queries';
import type { TaskAttrs } from '../db/model';
import type { Types } from 'mongoose';

type LeanArchiveTask = (TaskAttrs & {
  _id: Types.ObjectId;
  archived_at?: Date;
  archived_by?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) &
  Record<string, unknown>;

interface ArchivesRepository {
  listArchivedTasks(params: ArchiveListParams): Promise<{
    items: LeanArchiveTask[];
    total: number;
    page: number;
    pages: number;
  }>;
  purgeArchivedTasks(ids: string[]): Promise<number>;
}

class ArchivesService {
  private repo: ArchivesRepository;

  constructor(repo: ArchivesRepository) {
    this.repo = repo;
  }

  list(params: ArchiveListParams) {
    return this.repo.listArchivedTasks(params);
  }

  purge(ids: string[]) {
    return this.repo.purgeArchivedTasks(ids);
  }
}

export default ArchivesService;
