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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роут расчёта оптимального маршрута для нескольких машин
// Модули: express, express-validator, controllers/optimizer, middleware/auth
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validate_1 = __importDefault(require("../utils/validate"));
const ctrl = __importStar(require("../controllers/optimizer"));
const middleware_1 = require("../api/middleware");
const auth_1 = __importDefault(require("../middleware/auth"));
const router = (0, express_1.Router)();
router.post('/', (0, auth_1.default)(), ...(0, validate_1.default)([
    (0, express_validator_1.body)('tasks').isArray({ min: 1 }),
    (0, express_validator_1.body)('count').optional().isInt({ min: 1, max: 3 }),
    (0, express_validator_1.body)('method').optional().isIn(['angle', 'trip']),
]), (0, middleware_1.asyncHandler)(ctrl.optimize));
exports.default = router;
