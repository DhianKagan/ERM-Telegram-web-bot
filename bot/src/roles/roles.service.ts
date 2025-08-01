// Сервис ролей через репозиторий
// Основные модули: db/queries
class RolesService {
  repo
  constructor(repo) {
    this.repo = repo
  }
  list() {
    return this.repo.listRoles()
  }
  get(id) {
    return this.repo.getRole(id)
  }
  update(id, permissions) {
    return this.repo.updateRole(id, permissions)
  }
}

export default RolesService;
module.exports = RolesService;
