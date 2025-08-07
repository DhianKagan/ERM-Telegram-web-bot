// Сервис ролей через репозиторий
// Основные модули: db/queries
class RolesService {
  repo: any;
  constructor(repo: any) {
    this.repo = repo;
  }
  list() {
    return this.repo.listRoles();
  }
  get(id: any) {
    return this.repo.getRole(id);
  }
  update(id: any, permissions: any) {
    return this.repo.updateRole(id, permissions);
  }
}

export default RolesService;
module.exports = RolesService;
