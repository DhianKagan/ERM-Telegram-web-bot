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
// Контроллер черновиков задач
// Основные модули: express, taskDrafts.service, utils/problem
const tsyringe_1 = require("tsyringe");
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
const mapDraft = (draft) => ({
    id: String(draft._id),
    userId: draft.userId,
    kind: draft.kind,
    payload: draft.payload,
    attachments: draft.attachments ?? [],
    updatedAt: draft.updatedAt ?? null,
    createdAt: draft.createdAt ?? null,
});
let TaskDraftsController = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TaskDraftsController = _classThis = class {
        constructor(service) {
            this.service = service;
            this.get = async (req, res) => {
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
                const userId = Number(req.user?.id);
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
                const userId = Number(req.user?.id);
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
                const userId = Number(req.user?.id);
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
    __setFunctionName(_classThis, "TaskDraftsController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TaskDraftsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TaskDraftsController = _classThis;
})();
exports.default = TaskDraftsController;
