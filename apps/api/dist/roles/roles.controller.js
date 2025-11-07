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
const problem_1 = require("../utils/problem");
const sendCached_1 = require("../utils/sendCached");
let RolesController = class RolesController {
    constructor(service) {
        this.service = service;
        this.list = async (req, res) => {
            (0, sendCached_1.sendCached)(req, res, await this.service.list());
        };
        this.update = [
            validate_1.handleValidation,
            async (req, res) => {
                const role = await this.service.update(req.params.id, req.body.permissions);
                if (!role) {
                    (0, problem_1.sendProblem)(req, res, {
                        type: 'about:blank',
                        title: 'Роль не найдена',
                        status: 404,
                        detail: 'Not Found',
                    });
                    return;
                }
                res.json(role);
            },
        ];
    }
};
RolesController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.RolesService)),
    __metadata("design:paramtypes", [Function])
], RolesController);
exports.default = RolesController;
