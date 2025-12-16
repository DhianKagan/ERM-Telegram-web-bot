"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/route.ts
// Роут расчёта расстояния и геометрии маршрута
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validate_1 = __importDefault(require("../utils/validate"));
const route_1 = require("../services/route");
const middleware_1 = require("../api/middleware");
const auth_1 = __importDefault(require("../middleware/auth"));
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const rateLimits_1 = require("../rateLimits");
const wgLogEngine_1 = require("../services/wgLogEngine");
const router = (0, express_1.Router)();
const routeLimiter = (0, rateLimiter_1.default)(rateLimits_1.rateLimits.route);
const tableLimiter = (0, rateLimiter_1.default)(rateLimits_1.rateLimits.table);
router.post('/', (0, auth_1.default)(), routeLimiter, (0, validate_1.default)([
    (0, express_validator_1.body)('start.lat').isFloat(),
    (0, express_validator_1.body)('start.lng').isFloat(),
    (0, express_validator_1.body)('end.lat').isFloat(),
    (0, express_validator_1.body)('end.lng').isFloat(),
]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const data = await (0, route_1.getRouteDistance)(req.body.start, req.body.end);
    res.json(data);
}));
router.get('/table', (0, auth_1.default)(), tableLimiter, (0, validate_1.default)([(0, express_validator_1.query)('points').isString()]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const { points, ...params } = req.query;
    const max = Number(process.env.ROUTE_TABLE_MAX_POINTS || '25');
    const count = points.split(';').length;
    if (count > max) {
        res.status(400).json({ error: 'Слишком много точек' });
        return;
    }
    res.json(await (0, route_1.table)(points, params));
}));
router.get('/nearest', (0, auth_1.default)(), routeLimiter, (0, validate_1.default)([(0, express_validator_1.query)('point').isString()]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const { point, ...params } = req.query;
    res.json(await (0, route_1.nearest)(point, params));
}));
/**
 * GET /geometry
 * Returns { coordinates: Position[] } (or [] if no geometry).
 * We wrap routeGeometry in try/catch so that upstream 400/404 or other issues
 * don't propagate as 500 to the client — instead we log and return empty coordinates.
 */
router.get('/geometry', (0, auth_1.default)(), routeLimiter, (0, validate_1.default)([(0, express_validator_1.query)('points').isString()]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const { points, ...params } = req.query;
    try {
        const geometry = await (0, route_1.routeGeometry)(points, params);
        res.json({ coordinates: geometry !== null && geometry !== void 0 ? geometry : [] });
    }
    catch (err) {
        // Log with context and return empty coordinates rather than 500
        try {
            wgLogEngine_1.logger.warn({
                err: err instanceof Error ? { name: err.name, message: err.message } : err,
                points,
            }, 'routeGeometry failed - returning empty coordinates');
        }
        catch {
            // swallow logging errors
            // eslint-disable-next-line no-console
            console.warn('routeGeometry failed', err);
        }
        res.json({ coordinates: [] });
    }
}));
router.get('/match', (0, auth_1.default)(), routeLimiter, (0, validate_1.default)([(0, express_validator_1.query)('points').isString()]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const { points, ...params } = req.query;
    res.json(await (0, route_1.match)(points, params));
}));
router.get('/trip', (0, auth_1.default)(), routeLimiter, (0, validate_1.default)([(0, express_validator_1.query)('points').isString()]), (0, middleware_1.asyncHandler)(async (req, res) => {
    const { points, ...params } = req.query;
    res.json(await (0, route_1.trip)(points, params));
}));
exports.default = router;
