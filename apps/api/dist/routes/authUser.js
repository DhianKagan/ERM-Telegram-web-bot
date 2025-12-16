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
// Роуты регистрации, входа, обновления сессии и профиля
// Описывает send_code, verify_code, verify_init, logout, refresh и profile
// Модули: express, auth.controller, middleware/auth
const express_1 = require("express");
const authCtrl = __importStar(require("../auth/auth.controller"));
const middleware_1 = require("../api/middleware");
const auth_1 = __importDefault(require("../middleware/auth"));
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const rateLimits_1 = require("../rateLimits");
const validateDto_1 = __importDefault(require("../middleware/validateDto"));
const auth_dto_1 = require("../dto/auth.dto");
const router = (0, express_1.Router)();
const authLimiter = (0, rateLimiter_1.default)(rateLimits_1.rateLimits.auth);
router.post('/send_code', authLimiter, ...(0, validateDto_1.default)(auth_dto_1.SendCodeDto), (0, middleware_1.asyncHandler)(authCtrl.sendCode));
router.post('/verify_code', authLimiter, ...(0, validateDto_1.default)(auth_dto_1.VerifyCodeDto), (0, middleware_1.asyncHandler)(authCtrl.verifyCode));
router.post('/verify_init', authLimiter, ...(0, validateDto_1.default)(auth_dto_1.VerifyInitDto), (0, middleware_1.asyncHandler)(authCtrl.verifyInitData));
router.post('/logout', authLimiter, authCtrl.logout);
router.post('/refresh', (0, auth_1.default)(), authLimiter, authCtrl.refresh);
router.get('/profile', (0, auth_1.default)(), authLimiter, (0, middleware_1.asyncHandler)(authCtrl.profile));
router.patch('/profile', (0, auth_1.default)(), authLimiter, ...(0, validateDto_1.default)(auth_dto_1.UpdateProfileDto), (0, middleware_1.asyncHandler)(authCtrl.updateProfile));
exports.default = router;
