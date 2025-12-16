"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = initCustomAdmin;
// Назначение: кастомный бекенд админки без базовой аутентификации для путей /cp и /mg
// Модули: express, path, middleware/auth
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const auth_1 = __importDefault(require("../middleware/auth"));
function initCustomAdmin(app) {
    const router = express_1.default.Router();
    const pub = path_1.default.join(__dirname, '../../public');
    const spaPaths = ['/cp', '/mg'];
    const adminRateLimiter = (0, rateLimiter_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        name: 'admin',
    });
    router.use(adminRateLimiter);
    router.use(express_1.default.static(pub, { index: false }));
    router.use((req, _res, next) => {
        if (!req.headers.authorization && req.query.token) {
            req.headers.authorization = `Bearer ${req.query.token}`;
        }
        next();
    });
    router.use((0, auth_1.default)());
    router.use((req, res, next) => {
        var _a, _b;
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'manager' || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) === 'admin')
            return next();
        res.sendFile(path_1.default.join(pub, 'admin-placeholder.html'));
    });
    router.get('/*splat', (_req, res) => {
        res.sendFile(path_1.default.join(pub, 'index.html'));
    });
    app.use(spaPaths, router);
}
