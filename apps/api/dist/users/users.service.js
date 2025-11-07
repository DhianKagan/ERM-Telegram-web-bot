"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class UsersService {
    constructor(repo) {
        this.repo = repo;
    }
    list() {
        return this.repo.listUsers();
    }
    async create(id, username, roleId, data = {}) {
        const { telegramId, username: resolvedUsername } = await this.repo.generateUserCredentials(id, username);
        return this.repo.createUser(telegramId, resolvedUsername, roleId, data);
    }
    generate(id, username) {
        return this.repo.generateUserCredentials(id, username);
    }
    get(id) {
        return this.repo.getUser(id);
    }
    update(id, data) {
        return this.repo.updateUser(id, data);
    }
    remove(id) {
        return this.repo.removeUser(id);
    }
}
exports.default = UsersService;
