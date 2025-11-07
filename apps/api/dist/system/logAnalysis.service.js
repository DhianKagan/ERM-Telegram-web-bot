"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
let LogAnalysisService = class LogAnalysisService {
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
LogAnalysisService = __decorate([
    (0, tsyringe_1.injectable)()
], LogAnalysisService);
exports.default = LogAnalysisService;
