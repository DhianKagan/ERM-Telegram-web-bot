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
exports.default = checkTaskAccess;
const fs_1 = require("fs");
const accessMask_1 = require("../utils/accessMask");
const service = __importStar(require("../services/tasks"));
const service_1 = require("../services/service");
const problem_1 = require("../utils/problem");
async function checkTaskAccess(req, res, next) {
    const task = (await service.getById(req.params.id));
    if (!task) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Задача не найдена',
            status: 404,
            detail: 'Not Found',
        });
        return;
    }
    const mask = req.user?.access ?? accessMask_1.ACCESS_USER;
    const id = Number(req.user?.id);
    const hasElevatedAccess = (0, accessMask_1.hasAccess)(mask, accessMask_1.ACCESS_ADMIN) || (0, accessMask_1.hasAccess)(mask, accessMask_1.ACCESS_MANAGER);
    const assignedIds = new Set();
    if (typeof task.assigned_user_id === 'number') {
        assignedIds.add(task.assigned_user_id);
    }
    if (Array.isArray(task.assignees)) {
        task.assignees
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .forEach((value) => assignedIds.add(value));
    }
    const controllerIds = new Set();
    const primaryController = Number(task.controller_user_id);
    if (Number.isFinite(primaryController)) {
        controllerIds.add(primaryController);
    }
    if (Array.isArray(task.controllers)) {
        task.controllers
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .forEach((value) => controllerIds.add(value));
    }
    const status = typeof task.status === 'string' ? task.status : undefined;
    const isTaskNew = !status || status === 'Новая';
    const hasTaskStarted = status !== undefined && status !== 'Новая';
    const isCreator = Number.isFinite(id) && task.created_by === id;
    const isExecutor = Number.isFinite(id) && assignedIds.has(id);
    const isController = Number.isFinite(id) && controllerIds.has(id);
    const sameActor = isCreator && isExecutor;
    const method = req.method.toUpperCase();
    const routePath = typeof req.route?.path === 'string' ? req.route.path : '';
    const isTaskUpdateRoute = method === 'PATCH' && routePath === '/:id';
    const isStatusRoute = method === 'PATCH' &&
        (routePath === '/:id/status' || req.originalUrl.endsWith('/status'));
    if (hasElevatedAccess || isController) {
        req.task = task;
        next();
        return;
    }
    if (isTaskUpdateRoute) {
        if (isCreator && isTaskNew) {
            req.task = task;
            next();
            return;
        }
        if (isExecutor && !isCreator) {
            const payload = (req.body ?? {});
            const keys = Object.entries(payload)
                .filter(([, value]) => value !== undefined)
                .map(([key]) => key);
            const allowed = new Set(['status']);
            if (keys.every((key) => allowed.has(key))) {
                req.task = task;
                next();
                return;
            }
        }
    }
    else if (isStatusRoute) {
        if (isCreator) {
            if (!(sameActor && hasTaskStarted)) {
                req.task = task;
                next();
                return;
            }
        }
        if (isExecutor && !sameActor) {
            req.task = task;
            next();
            return;
        }
    }
    await (0, service_1.writeLog)(`Нет доступа ${req.method} ${req.originalUrl} user:${id}/${req.user?.username} ip:${req.ip}`).catch(() => { });
    const filesRaw = req.files;
    if (Array.isArray(filesRaw)) {
        await Promise.all(filesRaw
            .map((file) => {
            if (!file || typeof file !== 'object') {
                return undefined;
            }
            const record = file;
            return typeof record.path === 'string'
                ? fs_1.promises.unlink(record.path).catch(() => undefined)
                : undefined;
        })
            .filter(Boolean));
    }
    (0, problem_1.sendProblem)(req, res, {
        type: 'about:blank',
        title: 'Доступ запрещён',
        status: 403,
        detail: 'Forbidden',
    });
}
