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
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("tsyringe");
const validate_1 = require("../utils/validate");
const tokens_1 = require("../di/tokens");
let ArchivesController = class ArchivesController {
    constructor(service) {
        this.service = service;
        this.list = async (req, res) => {
            const params = {
                page: req.query.page ? Number(req.query.page) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                search: typeof req.query.search === 'string' ? req.query.search : undefined,
            };
            const data = await this.service.list(params);
            res.json(data);
        };
        this.purge = [
            validate_1.handleValidation,
            async (req, res) => {
                var _a;
                const ids = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.ids)
                    ? req.body.ids
                        .map((value) => (typeof value === 'string' ? value : String(value !== null && value !== void 0 ? value : '')).trim())
                        .filter((value) => value.length > 0)
                    : [];
                const removed = await this.service.purge(ids);
                res.json({ removed });
            },
        ];
    }
};
ArchivesController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.ArchivesService)),
    __metadata("design:paramtypes", [Function])
], ArchivesController);
exports.default = ArchivesController;
