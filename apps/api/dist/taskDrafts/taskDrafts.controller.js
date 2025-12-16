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
// Контроллер черновиков задач
// Основные модули: express, taskDrafts.service, utils/problem
const tsyringe_1 = require("tsyringe");
const tokens_1 = require("../di/tokens");
const taskDrafts_service_1 = __importDefault(require("./taskDrafts.service"));
const problem_1 = require("../utils/problem");
const normalizeKind = (value) => {
    if (value === 'task' || value === 'request') {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === 'task' || trimmed === 'request') {
            return trimmed;
        }
    }
    return null;
};
const mapDraft = (draft) => {
    var _a, _b, _c;
    return ({
        id: String(draft._id),
        userId: draft.userId,
        kind: draft.kind,
        payload: draft.payload,
        attachments: (_a = draft.attachments) !== null && _a !== void 0 ? _a : [],
        updatedAt: (_b = draft.updatedAt) !== null && _b !== void 0 ? _b : null,
        createdAt: (_c = draft.createdAt) !== null && _c !== void 0 ? _c : null,
    });
};
let TaskDraftsController = class TaskDraftsController {
    constructor(service) {
        this.service = service;
        this.get = async (req, res) => {
            var _a;
            const kind = normalizeKind(req.params.kind);
            if (!kind) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Некорректный тип черновика',
                    status: 400,
                    detail: 'Unknown draft kind',
                });
                return;
            }
            const userId = Number((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
            const draft = Number.isFinite(userId)
                ? await this.service.getDraft(userId, kind)
                : null;
            if (!draft) {
                res.status(404).json({ error: 'Черновик не найден' });
                return;
            }
            res.json(mapDraft({ ...draft, userId }));
        };
        this.save = async (req, res) => {
            var _a;
            const kind = normalizeKind(req.params.kind);
            if (!kind) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Некорректный тип черновика',
                    status: 400,
                    detail: 'Unknown draft kind',
                });
                return;
            }
            const userId = Number((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
            if (!Number.isFinite(userId)) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Ошибка авторизации',
                    status: 401,
                    detail: 'User id is missing',
                });
                return;
            }
            const payload = req.body.payload;
            const draft = await this.service.saveDraft(userId, kind, payload);
            res.status(200).json(mapDraft({ ...draft.toObject(), userId }));
        };
        this.remove = async (req, res) => {
            var _a;
            const kind = normalizeKind(req.params.kind);
            if (!kind) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Некорректный тип черновика',
                    status: 400,
                    detail: 'Unknown draft kind',
                });
                return;
            }
            const userId = Number((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
            if (!Number.isFinite(userId)) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Ошибка авторизации',
                    status: 401,
                    detail: 'User id is missing',
                });
                return;
            }
            await this.service.deleteDraft(userId, kind);
            res.sendStatus(204);
        };
    }
};
TaskDraftsController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.TaskDraftsService)),
    __metadata("design:paramtypes", [taskDrafts_service_1.default])
], TaskDraftsController);
exports.default = TaskDraftsController;
