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
        var _a, _b;
        return ((_b = (_a = this.repo).deleteTaskTemplate) === null || _b === void 0 ? void 0 : _b.call(_a, id)) || null;
    }
}
exports.default = TaskTemplatesService;
