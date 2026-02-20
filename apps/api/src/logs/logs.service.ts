// Сервис логов через репозиторий
// Основные модули: db/queries, services/wgLogEngine
import { Log } from '../db/model';
import { CollectionItem } from '../db/models/CollectionItem';
import { clearLogs, ListLogParams } from '../services/wgLogEngine';

interface LogsRepo {
  listLogs(params: ListLogParams): Promise<unknown>;
  writeLog(
    message: string,
    level?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}

class LogsService {
  private repo: LogsRepo;

  constructor(repo: LogsRepo) {
    this.repo = repo;
  }

  list(params: ListLogParams) {
    const scope = params.scope === 'all' ? 'all' : 'user';
    return this.repo.listLogs({ ...params, scope });
  }

  write(message: string) {
    return this.repo.writeLog(message);
  }

  async clearRuntimeLogs(): Promise<number> {
    return clearLogs();
  }

  async clearDatabaseLogs(): Promise<{ logDocs: number; eventLogs: number }> {
    const [logResult, eventResult] = await Promise.all([
      Log.deleteMany({}),
      CollectionItem.deleteMany({ type: 'event_logs' }),
    ]);

    return {
      logDocs: logResult.deletedCount ?? 0,
      eventLogs: eventResult.deletedCount ?? 0,
    };
  }
}

export default LogsService;
