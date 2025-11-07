"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskTemplatesService {
    constructor(repo) {
        this.repo = repo;
    }
    create(data) {
        return this.repo.createTaskTemplate(data);
    }
    list() {
        return this.repo.listTaskTemplates();
    }
    getById(id) {
        return this.repo.getTaskTemplate(id);
    }
    remove(id) {
        return this.repo.deleteTaskTemplate?.(id) || null;
    }
}
exports.default = TaskTemplatesService;
