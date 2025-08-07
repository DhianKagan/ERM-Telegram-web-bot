// Сервис логов через репозиторий
// Основные модули: db/queries, services/wgLogEngine
import { ListLogParams } from '../services/wgLogEngine';

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
    return this.repo.listLogs(params);
  }

  write(message: string) {
    return this.repo.writeLog(message);
  }
}

export default LogsService;
module.exports = LogsService;
