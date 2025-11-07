"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimize = optimize;
const express_validator_1 = require("express-validator");
const service = __importStar(require("../services/optimizer"));
const problem_1 = require("../utils/problem");
const normalizeTasks = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((taskId) => typeof taskId === 'string' ? taskId.trim() : taskId != null ? String(taskId) : '')
        .filter((taskId) => Boolean(taskId));
};
const normalizeCount = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
async function optimize(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const errorList = errors.array();
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка валидации',
            status: 400,
            detail: 'Ошибка валидации',
            errors: errorList,
        });
        return;
    }
    const actorIdRaw = req.user?.id;
    const actorId = typeof actorIdRaw === 'number' && Number.isFinite(actorIdRaw)
        ? actorIdRaw
        : typeof actorIdRaw === 'string' && actorIdRaw.trim()
            ? Number(actorIdRaw)
            : undefined;
    const tasks = normalizeTasks(req.body?.tasks);
    const count = normalizeCount(req.body?.count);
    const method = req.body?.method;
    const plan = await service.optimize(tasks, count ?? 1, method, Number.isFinite(actorId) ? actorId : undefined);
    res.json({ plan });
}
