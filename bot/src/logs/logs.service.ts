// Сервис логов через репозиторий
// Основные модули: db/queries
class LogsService {
  repo
  constructor(repo) {
    this.repo = repo
  }
  list(params) {
    return this.repo.listLogs(params)
  }
  write(message) {
    return this.repo.writeLog(message)
  }
}

export default LogsService;
module.exports = LogsService;
