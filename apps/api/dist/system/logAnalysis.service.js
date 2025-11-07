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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: сервис чтения последних отчётов анализа логов Railway и подготовки сводки
// Основные модули: fs/promises, path
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const tsyringe_1 = require("tsyringe");
let LogAnalysisService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var LogAnalysisService = _classThis = class {
        constructor() {
            this.analysisDir = node_path_1.default.resolve(__dirname, '../../..', 'Railway', 'analysis');
        }
        async getLatestSummary() {
            let entries;
            try {
                entries = await promises_1.default.readdir(this.analysisDir, { withFileTypes: true });
            }
            catch (error) {
                if (error.code === 'ENOENT') {
                    return null;
                }
                throw error;
            }
            const candidates = await Promise.all(entries
                .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
                .map(async (entry) => {
                const filePath = node_path_1.default.join(this.analysisDir, entry.name);
                const stat = await promises_1.default.stat(filePath);
                return { filePath, mtime: stat.mtimeMs };
            }));
            if (!candidates.length) {
                return null;
            }
            const latest = candidates.reduce((acc, current) => current.mtime > acc.mtime ? current : acc);
            const raw = await promises_1.default.readFile(latest.filePath, 'utf8');
            const payload = JSON.parse(raw);
            const stats = payload.stats ?? { totalLines: 0, errors: 0, warnings: 0, infos: 0 };
            const fallbackDate = new Date(latest.mtime).toISOString();
            const normalizeIssues = (list) => {
                if (!Array.isArray(list)) {
                    return [];
                }
                return list
                    .map((item) => {
                    if (!item || typeof item !== 'object') {
                        return null;
                    }
                    const record = item;
                    const message = typeof record.message === 'string' ? record.message : '';
                    if (!message) {
                        return null;
                    }
                    const samples = Array.isArray(record.samples)
                        ? record.samples.filter((value) => typeof value === 'string')
                        : undefined;
                    const context = Array.isArray(record.context)
                        ? record.context.filter((value) => typeof value === 'string')
                        : undefined;
                    return {
                        message,
                        count: Number(record.count ?? 0),
                        samples,
                        context,
                    };
                })
                    .filter(Boolean);
            };
            const normalizeRecommendations = (list) => {
                if (!Array.isArray(list)) {
                    return [];
                }
                return list
                    .map((item) => {
                    if (!item || typeof item !== 'object') {
                        return null;
                    }
                    const record = item;
                    const id = typeof record.id === 'string' ? record.id : '';
                    const title = typeof record.title === 'string' ? record.title : '';
                    const reason = typeof record.reason === 'string' ? record.reason : '';
                    if (!id || !title || !reason) {
                        return null;
                    }
                    const command = typeof record.command === 'string' ? record.command : undefined;
                    return {
                        id,
                        title,
                        reason,
                        command,
                        autoRun: Boolean(record.autoRun),
                    };
                })
                    .filter(Boolean);
            };
            return {
                generatedAt: payload.generatedAt ?? fallbackDate,
                baseName: payload.baseName ?? node_path_1.default.basename(latest.filePath, '.json'),
                logPath: payload.logPath ?? '',
                stats: {
                    totalLines: Number(stats.totalLines ?? 0),
                    errors: Number(stats.errors ?? 0),
                    warnings: Number(stats.warnings ?? 0),
                    infos: Number(stats.infos ?? 0),
                },
                errors: normalizeIssues(payload.errors),
                warnings: normalizeIssues(payload.warnings),
                recommendations: normalizeRecommendations(payload.recommendations),
                sourceFile: latest.filePath,
            };
        }
    };
    __setFunctionName(_classThis, "LogAnalysisService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LogAnalysisService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LogAnalysisService = _classThis;
})();
exports.default = LogAnalysisService;
