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
const tsyringe_1 = require("tsyringe");
const validate_1 = require("../utils/validate");
const formatUser_1 = __importDefault(require("../utils/formatUser"));
const sendCached_1 = require("../utils/sendCached");
const problem_1 = require("../utils/problem");
let UsersController = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var UsersController = _classThis = class {
        constructor(service) {
            this.service = service;
            this.list = async (req, res) => {
                const users = await this.service.list();
                (0, sendCached_1.sendCached)(req, res, users.map((u) => (0, formatUser_1.default)(u)));
            };
            this.get = async (req, res) => {
                const user = await this.service.get(req.params.id);
                if (!user) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Пользователь не найден',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                res.json((0, formatUser_1.default)(user));
            };
            this.create = [
                validate_1.handleValidation,
                async (req, res) => {
                    const rawId = req.body.id;
                    const rawUsername = req.body.username;
                    const normalizedId = typeof rawId === 'string'
                        ? rawId.trim() || undefined
                        : rawId !== undefined
                            ? rawId
                            : undefined;
                    const normalizedUsername = typeof rawUsername === 'string'
                        ? rawUsername.trim() || undefined
                        : rawUsername !== undefined
                            ? String(rawUsername)
                            : undefined;
                    const normalizedRoleId = typeof req.body.roleId === 'string'
                        ? req.body.roleId.trim() || undefined
                        : req.body.roleId;
                    if (req.query.preview === 'true' || req.query.preview === '1') {
                        const generated = await this.service.generate(normalizedId, normalizedUsername);
                        res.json({
                            telegram_id: generated.telegramId,
                            username: generated.username,
                        });
                        return;
                    }
                    const user = await this.service.create(normalizedId, normalizedUsername, normalizedRoleId);
                    res.status(201).json((0, formatUser_1.default)(user));
                },
            ];
            this.update = [
                validate_1.handleValidation,
                async (req, res) => {
                    const user = await this.service.update(req.params.id, req.body);
                    if (!user) {
                        (0, problem_1.sendProblem)(req, res, {
                            type: 'about:blank',
                            title: 'Пользователь не найден',
                            status: 404,
                            detail: 'Not Found',
                        });
                        return;
                    }
                    res.json((0, formatUser_1.default)(user));
                },
            ];
            this.remove = async (req, res) => {
                const removed = await this.service.remove(req.params.id);
                if (!removed) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Пользователь не найден',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                res.json({ status: 'ok' });
            };
        }
    };
    __setFunctionName(_classThis, "UsersController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsersController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsersController = _classThis;
})();
exports.default = UsersController;
