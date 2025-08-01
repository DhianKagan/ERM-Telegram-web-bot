// Сервис пользователей через репозиторий
// Основные модули: db/queries, utils/formatUser
class UsersService {
  repo
  constructor(repo) {
    this.repo = repo;
  }
  list() {
    return this.repo.listUsers();
  }
  create(id, username, roleId) {
    return this.repo.createUser(id, username, roleId);
  }
  get(id) {
    return this.repo.getUser(id);
  }
  update(id, data) {
    return this.repo.updateUser(id, data);
  }
}

export default UsersService;
module.exports = UsersService;
