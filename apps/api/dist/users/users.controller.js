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
const tsyringe_1 = require("tsyringe");
const validate_1 = require("../utils/validate");
const tokens_1 = require("../di/tokens");
const formatUser_1 = __importDefault(require("../utils/formatUser"));
const sendCached_1 = require("../utils/sendCached");
const problem_1 = require("../utils/problem");
let UsersController = class UsersController {
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
UsersController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.UsersService)),
    __metadata("design:paramtypes", [Function])
], UsersController);
exports.default = UsersController;
