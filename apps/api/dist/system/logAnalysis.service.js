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
        var _a, _b, _c, _d, _e, _f, _g, _h;
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
        const stats = (_a = payload.stats) !== null && _a !== void 0 ? _a : {
            totalLines: 0,
            errors: 0,
            warnings: 0,
            infos: 0,
        };
        const fallbackDate = new Date(latest.mtime).toISOString();
        const normalizeIssues = (list) => {
            if (!Array.isArray(list)) {
                return [];
            }
            return list
                .map((item) => {
                var _a;
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
                    count: Number((_a = record.count) !== null && _a !== void 0 ? _a : 0),
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
            generatedAt: (_b = payload.generatedAt) !== null && _b !== void 0 ? _b : fallbackDate,
            baseName: (_c = payload.baseName) !== null && _c !== void 0 ? _c : node_path_1.default.basename(latest.filePath, '.json'),
            logPath: (_d = payload.logPath) !== null && _d !== void 0 ? _d : '',
            stats: {
                totalLines: Number((_e = stats.totalLines) !== null && _e !== void 0 ? _e : 0),
                errors: Number((_f = stats.errors) !== null && _f !== void 0 ? _f : 0),
                warnings: Number((_g = stats.warnings) !== null && _g !== void 0 ? _g : 0),
                infos: Number((_h = stats.infos) !== null && _h !== void 0 ? _h : 0),
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
