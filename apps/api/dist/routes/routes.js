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
// Роуты для получения маршрутов
// Модули: express, express-validator, controllers/routes, middleware/auth
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const ctrl = __importStar(require("../controllers/routes"));
const middleware_1 = require("../api/middleware");
const auth_1 = __importDefault(require("../middleware/auth"));
const problem_1 = require("../utils/problem");
const router = (0, express_1.Router)();
const validate = (v) => [
    ...v,
    (req, res, next) => {
        const errors = (0, express_validator_1.validationResult)(req);
        if (errors.isEmpty())
            return next();
        const errorList = errors.array();
        (0, problem_1.sendProblem)(req, res, {
            type: 'about:blank',
            title: 'Ошибка валидации',
            status: 400,
            detail: 'Ошибка валидации',
            errors: errorList,
        });
    },
];
router.get('/all', (0, auth_1.default)(), validate([
    (0, express_validator_1.query)('from').optional().isISO8601(),
    (0, express_validator_1.query)('to').optional().isISO8601(),
    (0, express_validator_1.query)('status').optional().isString(),
]), (0, middleware_1.asyncHandler)(ctrl.all));
exports.default = router;
