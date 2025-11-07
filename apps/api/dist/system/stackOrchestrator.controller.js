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
const tokens_1 = require("../di/tokens");
const stackOrchestrator_service_1 = __importDefault(require("./stackOrchestrator.service"));
let StackOrchestratorController = class StackOrchestratorController {
    constructor(service) {
        this.service = service;
        this.overview = async (_req, res) => {
            const overview = await this.service.overview();
            res.json(overview);
        };
        this.coordinate = async (_req, res) => {
            const result = await this.service.executePlan();
            res.json(result);
        };
        this.latestLogAnalysis = async (_req, res) => {
            const summary = await this.service.latestLogAnalysis();
            res.json(summary);
        };
        this.codexBrief = async (_req, res) => {
            const brief = await this.service.codexBrief();
            res.json(brief);
        };
    }
};
StackOrchestratorController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)(tokens_1.TOKENS.StackOrchestratorService)),
    __metadata("design:paramtypes", [stackOrchestrator_service_1.default])
], StackOrchestratorController);
exports.default = StackOrchestratorController;
