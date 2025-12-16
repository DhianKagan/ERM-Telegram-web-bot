"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роут карт: разворачивание ссылок Google Maps
// Модули: express, express-validator, services/maps, middleware/auth
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validate_1 = __importDefault(require("../utils/validate"));
const maps_1 = require("../controllers/maps");
const middleware_1 = require("../api/middleware");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = (0, express_1.Router)();
router.post('/expand', (0, auth_1.default)(), (0, validate_1.default)([(0, express_validator_1.body)('url').isString().notEmpty()]), (0, middleware_1.asyncHandler)(maps_1.expand));
router.get('/search', (0, auth_1.default)(), (0, validate_1.default)([
    (0, express_validator_1.query)('q').isString().trim().isLength({ min: 3, max: 200 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 10 }),
]), (0, middleware_1.asyncHandler)(maps_1.search));
router.get('/reverse', (0, auth_1.default)(), (0, validate_1.default)([
    (0, express_validator_1.query)('lat').isFloat({ min: -90, max: 90 }),
    (0, express_validator_1.query)('lng').optional().isFloat({ min: -180, max: 180 }).bail(),
    (0, express_validator_1.query)('lon').optional().isFloat({ min: -180, max: 180 }).bail(),
    (0, express_validator_1.query)('lat').custom((_, { req }) => {
        var _a, _b;
        const hasLng = typeof ((_a = req === null || req === void 0 ? void 0 : req.query) === null || _a === void 0 ? void 0 : _a.lng) === 'string';
        const hasLon = typeof ((_b = req === null || req === void 0 ? void 0 : req.query) === null || _b === void 0 ? void 0 : _b.lon) === 'string';
        if (!hasLng && !hasLon) {
            throw new Error('lng or lon is required');
        }
        return true;
    }),
]), (0, middleware_1.asyncHandler)(maps_1.reverse));
exports.default = router;
