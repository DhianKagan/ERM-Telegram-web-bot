// Сервис пользователей через репозиторий
// Основные модули: db/queries, utils/formatUser
class UsersService {
  repo: any;
  constructor(repo: any) {
    this.repo = repo;
  }
  list() {
    return this.repo.listUsers();
  }
  create(id: string, username: string, roleId: string) {
    return this.repo.createUser(id, username, roleId);
  }
  get(id: string) {
    return this.repo.getUser(id);
  }
  update(id: string, data: any) {
    return this.repo.updateUser(id, data);
  }
}

export default UsersService;
module.exports = UsersService;
