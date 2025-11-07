"use strict";
// Маршруты управления маршрутными планами.
// Основные модули: express, express-validator, controllers/routePlans
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = __importDefault(require("../middleware/auth"));
const middleware_1 = require("../api/middleware");
const validate_1 = __importDefault(require("../utils/validate"));
const ctrl = __importStar(require("../controllers/routePlans"));
const router = (0, express_1.Router)();
router.get('/', (0, auth_1.default)(), ...(0, validate_1.default)([
    (0, express_validator_1.query)('status').optional().isIn(['draft', 'approved', 'completed']),
    (0, express_validator_1.query)('page').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
]), (0, middleware_1.asyncHandler)(ctrl.list));
router.get('/:id', (0, auth_1.default)(), (0, middleware_1.asyncHandler)(ctrl.detail));
router.patch('/:id', (0, auth_1.default)(), ...(0, validate_1.default)([
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('notes').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes').optional().isArray(),
    (0, express_validator_1.body)('routes.*.id').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.order').optional().isInt(),
    (0, express_validator_1.body)('routes.*.vehicleId').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.vehicleName').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.driverId').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.driverName').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.notes').optional({ nullable: true }).isString(),
    (0, express_validator_1.body)('routes.*.tasks').optional().isArray({ min: 1 }),
    (0, express_validator_1.body)('routes.*.tasks.*').optional().isString(),
]), (0, middleware_1.asyncHandler)(ctrl.update));
router.patch('/:id/status', (0, auth_1.default)(), ...(0, validate_1.default)([
    (0, express_validator_1.body)('status').isIn(['draft', 'approved', 'completed']),
]), (0, middleware_1.asyncHandler)(ctrl.changeStatus));
router.delete('/:id', (0, auth_1.default)(), (0, middleware_1.asyncHandler)(ctrl.remove));
exports.default = router;
