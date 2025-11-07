"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ArchivesService {
    constructor(repo) {
        this.repo = repo;
    }
    list(params) {
        return this.repo.listArchivedTasks(params);
    }
    purge(ids) {
        return this.repo.purgeArchivedTasks(ids);
    }
}
exports.default = ArchivesService;
