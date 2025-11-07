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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: dataStorage, logAnalysis.service
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../di/tokens");
const logAnalysis_service_1 = __importDefault(require("./logAnalysis.service"));
const dataStorage_1 = require("../services/dataStorage");
let StackOrchestratorService = class StackOrchestratorService {
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
StackOrchestratorService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.LogAnalysisService)),
    __metadata("design:paramtypes", [logAnalysis_service_1.default])
], StackOrchestratorService);
exports.default = StackOrchestratorService;
