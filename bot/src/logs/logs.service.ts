// Сервис логов через репозиторий
// Основные модули: db/queries
class LogsService {
  repo: any;
  constructor(repo: any) {
    this.repo = repo;
  }
  list(params: any) {
    return this.repo.listLogs(params);
  }
  write(message: any) {
    return this.repo.writeLog(message);
  }
}

export default LogsService;
module.exports = LogsService;
