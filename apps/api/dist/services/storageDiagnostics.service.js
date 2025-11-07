"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Сервис диагностики и обслуживания файлового хранилища
// Основные модули: tsyringe, mongoose, services/dataStorage
const tsyringe_1 = require("tsyringe");
const mongoose_1 = require("mongoose");
const tokens_1 = require("../di/tokens");
const dataStorage_1 = require("./dataStorage");
let StorageDiagnosticsService = class StorageDiagnosticsService {
    constructor(fileModel) {
        this.fileModel = fileModel;
    }
    get detachedFilter() {
        return {
            $or: [{ taskId: null }, { taskId: { $exists: false } }],
        };
    }
    async restoreDetachedLinks() {
        const candidates = await this.fileModel
            .find(this.detachedFilter)
            .select(['_id'])
            .lean();
        if (candidates.length === 0) {
            return { attempted: 0, repaired: 0, errors: 0 };
        }
        const lookup = await (0, dataStorage_1.collectAttachmentLinks)(candidates.map((candidate) => ({
            id: String(candidate._id),
            hasTask: false,
        })));
        if (lookup.size === 0) {
            return { attempted: 0, repaired: 0, errors: 0 };
        }
        let repaired = 0;
        let errors = 0;
        for (const [fileId, info] of lookup.entries()) {
            let failed = false;
            const targetTaskId = mongoose_1.Types.ObjectId.isValid(info.taskId)
                ? new mongoose_1.Types.ObjectId(info.taskId)
                : null;
            if (!targetTaskId) {
                console.error('Не удалось восстановить привязку файла к задаче', {
                    fileId,
                    taskId: info.taskId,
                    error: new Error('Некорректный идентификатор задачи'),
                });
                errors += 1;
                continue;
            }
            try {
                await this.fileModel
                    .updateOne({ _id: new mongoose_1.Types.ObjectId(fileId) }, { $set: { taskId: targetTaskId } })
                    .exec();
            }
            catch (error) {
                failed = true;
                console.error('Не удалось восстановить привязку файла к задаче', {
                    fileId,
                    taskId: info.taskId,
                    error,
                });
            }
            if (failed) {
                errors += 1;
            }
            else {
                repaired += 1;
            }
        }
        return {
            attempted: lookup.size,
            repaired,
            errors,
        };
    }
    async generateReport() {
        const [snapshot, detachedDocs] = await Promise.all([
            (0, dataStorage_1.getFileSyncSnapshot)(),
            this.fileModel
                .find(this.detachedFilter)
                .select(['_id', 'name', 'path', 'size', 'uploadedAt', 'userId'])
                .lean(),
        ]);
        const detachedFiles = detachedDocs.map((doc) => ({
            id: String(doc._id),
            name: doc.name,
            path: doc.path,
            size: doc.size,
            uploadedAt: doc.uploadedAt,
            userId: doc.userId,
        }));
        return {
            generatedAt: new Date().toISOString(),
            snapshot,
            detachedFiles,
        };
    }
    async diagnose() {
        await this.restoreDetachedLinks();
        return this.generateReport();
    }
    async remediate() {
        const outcome = await this.restoreDetachedLinks();
        const report = await this.generateReport();
        let status = 'completed';
        let details = 'Привязка файлов проверена.';
        if (outcome.attempted === 0) {
            status = 'skipped';
            details = 'Несвязанных файлов не найдено.';
        }
        else if (outcome.repaired === 0 && outcome.errors === 0) {
            status = 'skipped';
            details = 'Подходящих задач для восстановления не обнаружено.';
        }
        else if (outcome.errors > 0 && outcome.repaired === 0) {
            status = 'failed';
            details = 'Не удалось восстановить привязку файлов, проверьте журнал.';
        }
        else if (outcome.errors > 0) {
            status = 'completed';
            details = 'Часть файлов восстановлена, проверьте журнал для деталей.';
        }
        else {
            details = 'Привязка файлов восстановлена автоматически.';
        }
        return {
            generatedAt: new Date().toISOString(),
            results: [
                {
                    action: 'restoreDetachedLinks',
                    status,
                    details,
                    attempted: outcome.attempted,
                    repaired: outcome.repaired,
                    errors: outcome.errors,
                },
            ],
            report,
        };
    }
};
StorageDiagnosticsService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.FileModel)),
    __metadata("design:paramtypes", [Function])
], StorageDiagnosticsService);
exports.default = StorageDiagnosticsService;
