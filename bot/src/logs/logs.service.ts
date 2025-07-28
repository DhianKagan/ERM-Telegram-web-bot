// Сервис логов через репозиторий
// Основные модули: db/queries
class LogsService {
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
module.exports = LogsService
