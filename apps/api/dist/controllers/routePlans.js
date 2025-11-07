"use strict";
// Назначение: контроллеры для маршрутных планов.
// Основные модули: express-validator, services/routePlans
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.detail = detail;
exports.update = update;
exports.changeStatus = changeStatus;
exports.remove = remove;
const express_validator_1 = require("express-validator");
const routePlans_1 = require("../services/routePlans");
const problem_1 = require("../utils/problem");
const parseActorId = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return undefined;
        const parsed = Number.parseInt(trimmed, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};
async function list(req, res) {
    const { status, page, limit } = req.query;
    const filters = {
        status: typeof status === 'string' && status.trim()
            ? status.trim()
            : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
    };
    const result = await (0, routePlans_1.listPlans)(filters);
    res.json(result);
}
async function detail(req, res) {
    const plan = await (0, routePlans_1.getPlan)(req.params.id);
    if (!plan) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Маршрутный план не найден',
            status: 404,
            detail: 'Маршрутный план не найден',
        });
        return;
    }
    res.json({ plan });
}
const normalizeRoutesPayload = (routes) => {
    if (!Array.isArray(routes))
        return undefined;
    return routes
        .map((route) => {
        if (!route || typeof route !== 'object')
            return null;
        const data = route;
        const rawDriverId = data.driverId;
        let driverId;
        if (rawDriverId === null) {
            driverId = null;
        }
        else if (typeof rawDriverId === 'number' && Number.isFinite(rawDriverId)) {
            driverId = Number(rawDriverId);
        }
        else if (typeof rawDriverId === 'string') {
            const trimmed = rawDriverId.trim();
            driverId = trimmed ? trimmed : undefined;
        }
        const notesRaw = data.notes;
        const normalized = {
            id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : undefined,
            order: typeof data.order === 'number' && Number.isFinite(data.order)
                ? Number(data.order)
                : undefined,
            vehicleId: data.vehicleId === null
                ? null
                : typeof data.vehicleId === 'string' && data.vehicleId.trim()
                    ? data.vehicleId.trim()
                    : undefined,
            vehicleName: typeof data.vehicleName === 'string' && data.vehicleName.trim()
                ? data.vehicleName.trim()
                : undefined,
            driverId,
            driverName: typeof data.driverName === 'string' && data.driverName.trim()
                ? data.driverName.trim()
                : undefined,
            notes: notesRaw === null
                ? null
                : typeof notesRaw === 'string' && notesRaw.trim()
                    ? notesRaw.trim()
                    : undefined,
            tasks: Array.isArray(data.tasks)
                ? data.tasks.map((taskId) => String(taskId)).filter((taskId) => !!taskId)
                : [],
        };
        return normalized;
    })
        .filter((route) => Boolean(route));
};
async function update(req, res) {
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
    const payload = {
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        notes: req.body?.notes === null || typeof req.body?.notes === 'string'
            ? req.body?.notes
            : undefined,
        routes: normalizeRoutesPayload(req.body?.routes),
    };
    const plan = await (0, routePlans_1.updatePlan)(req.params.id, payload);
    if (!plan) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Маршрутный план не найден',
            status: 404,
            detail: 'Маршрутный план не найден',
        });
        return;
    }
    res.json({ plan });
}
async function changeStatus(req, res) {
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
    const statusValue = req.body?.status;
    const status = (typeof statusValue === 'string'
        ? statusValue.trim()
        : statusValue);
    const actorId = parseActorId(req.user?.id);
    const plan = await (0, routePlans_1.updatePlanStatus)(req.params.id, status, actorId);
    if (!plan) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Маршрутный план не найден',
            status: 404,
            detail: 'Маршрутный план не найден',
        });
        return;
    }
    res.json({ plan });
}
async function remove(req, res) {
    const deleted = await (0, routePlans_1.removePlan)(req.params.id);
    if (!deleted) {
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Маршрутный план не найден',
            status: 404,
            detail: 'Маршрутный план не найден',
        });
        return;
    }
    res.status(204).send();
}
exports.default = {
    list,
    detail,
    update,
    changeStatus,
    remove,
};
