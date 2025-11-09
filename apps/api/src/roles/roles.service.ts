// Сервис ролей через репозиторий
// Основные модули: db/queries
interface RolesRepo {
  listRoles(): Promise<unknown>;
  getRole(id: string): Promise<unknown>;
  updateRole(id: string, permissions: unknown): Promise<unknown>;
}

class RolesService {
  repo: RolesRepo;
  constructor(repo: RolesRepo) {
    this.repo = repo;
  }
  list() {
    return this.repo.listRoles();
  }
  get(id: string) {
    return this.repo.getRole(id);
  }
  update(id: string, permissions: unknown) {
    return this.repo.updateRole(id, permissions);
  }
}

export default RolesService;
