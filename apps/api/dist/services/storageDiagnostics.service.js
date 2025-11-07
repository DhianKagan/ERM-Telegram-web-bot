"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
// Сервис диагностики и обслуживания файлового хранилища
// Основные модули: tsyringe, mongoose, services/dataStorage
const tsyringe_1 = require("tsyringe");
const mongoose_1 = require("mongoose");
const dataStorage_1 = require("./dataStorage");
let StorageDiagnosticsService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var StorageDiagnosticsService = _classThis = class {
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
    __setFunctionName(_classThis, "StorageDiagnosticsService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StorageDiagnosticsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StorageDiagnosticsService = _classThis;
})();
exports.default = StorageDiagnosticsService;
