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
// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: dataStorage, logAnalysis.service
const tsyringe_1 = require("tsyringe");
const dataStorage_1 = require("../services/dataStorage");
let StackOrchestratorService = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var StackOrchestratorService = _classThis = class {
        constructor(logAnalysis) {
            this.logAnalysis = logAnalysis;
        }
        async collectSnapshot() {
            return Promise.all([
                (0, dataStorage_1.getFileSyncSnapshot)(),
                this.logAnalysis.getLatestSummary(),
            ]);
        }
        async overview() {
            const [fileSync, logAnalysis] = await this.collectSnapshot();
            return {
                generatedAt: new Date().toISOString(),
                fileSync,
                logAnalysis,
            };
        }
        async executePlan() {
            const [fileSync, logAnalysis] = await this.collectSnapshot();
            return {
                generatedAt: new Date().toISOString(),
                fileSync,
                logAnalysis,
            };
        }
        async latestLogAnalysis() {
            return this.logAnalysis.getLatestSummary();
        }
        async codexBrief() {
            const [fileSync, logAnalysis] = await this.collectSnapshot();
            const lines = [];
            lines.push('Контекст обслуживания инфраструктуры для Codex.');
            lines.push('');
            lines.push('Состояние файлового хранилища:');
            lines.push(`- Всего файлов: ${fileSync.totalFiles}, связанных с задачами: ${fileSync.linkedFiles}, без задач: ${fileSync.detachedFiles}.`);
            if (fileSync.detachedFiles === 0) {
                lines.push('- Несвязанных вложений не обнаружено, синхронизация в норме.');
            }
            else {
                lines.push('- Обнаружены файлы без задач, требуется ручная проверка и очистка.');
            }
            if (logAnalysis) {
                lines.push('');
                lines.push('Анализ логов Railway:');
                lines.push(`- Отчёт: ${logAnalysis.baseName}, ошибок: ${logAnalysis.stats.errors}, предупреждений: ${logAnalysis.stats.warnings}, информационных сообщений: ${logAnalysis.stats.infos}.`);
                const topErrors = logAnalysis.errors.slice(0, 3);
                if (topErrors.length) {
                    lines.push('- Ключевые ошибки:');
                    topErrors.forEach((error) => {
                        lines.push(`  • ${error.message} — ${error.count} повторов.`);
                    });
                }
                const topWarnings = logAnalysis.warnings.slice(0, 3);
                if (topWarnings.length) {
                    lines.push('- Основные предупреждения:');
                    topWarnings.forEach((warning) => {
                        lines.push(`  • ${warning.message} — ${warning.count} повторов.`);
                    });
                }
                const autoCommands = logAnalysis.recommendations.filter((rec) => rec.autoRun && rec.command);
                const manualRecs = logAnalysis.recommendations.filter((rec) => !rec.autoRun);
                if (autoCommands.length) {
                    lines.push('- Автоматические команды:');
                    autoCommands.forEach((rec) => {
                        lines.push(`  • ${rec.command} ← ${rec.reason}`);
                    });
                }
                if (manualRecs.length) {
                    lines.push('- Ручные рекомендации:');
                    manualRecs.forEach((rec) => {
                        lines.push(`  • ${rec.title}: ${rec.reason}`);
                    });
                }
            }
            else {
                lines.push('');
                lines.push('Анализ логов Railway недоступен: свежие отчёты не найдены.');
            }
            return {
                generatedAt: new Date().toISOString(),
                prompt: lines.join('\n'),
                fileSync,
                logAnalysis,
            };
        }
    };
    __setFunctionName(_classThis, "StackOrchestratorService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        StackOrchestratorService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return StackOrchestratorService = _classThis;
})();
exports.default = StackOrchestratorService;
