"use strict";
// Назначение: контроллеры аналитики маршрутных планов.
// Основные модули: express, express-validator, services/routePlanAnalytics
Object.defineProperty(exports, "__esModule", { value: true });
exports.routePlanSummary = routePlanSummary;
const routePlanAnalytics_1 = require("../services/routePlanAnalytics");
const problem_1 = require("../utils/problem");
const parseDate = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }
    const candidate = new Date(value);
    if (Number.isNaN(candidate.getTime())) {
        return undefined;
    }
    return candidate;
};
const parseStatus = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim();
    if (!normalized)
        return undefined;
    if (normalized === 'draft' || normalized === 'approved' || normalized === 'completed') {
        return normalized;
    }
    return undefined;
};
async function routePlanSummary(req, res) {
    try {
        const result = await (0, routePlanAnalytics_1.fetchRoutePlanAnalytics)({
            from: parseDate(req.query.from),
            to: parseDate(req.query.to),
            status: parseStatus(req.query.status),
        });
        res.json(result);
    }
    catch (error) {
        console.error('Не удалось получить аналитику маршрутных планов', error);
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка аналитики',
            status: 500,
            detail: 'Не удалось рассчитать метрики маршрутных планов',
        });
    }
}
exports.default = { routePlanSummary };
