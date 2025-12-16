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
exports.default = registerRoutes;
// Назначение файла: настройка маршрутов HTTP API.
// Основные модули: express, middleware, сервисы, роутеры
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("node:fs/promises");
const cors_1 = __importDefault(require("cors"));
const lusca_1 = __importDefault(require("lusca"));
const express_validator_1 = require("express-validator");
const rateLimiter_1 = __importDefault(require("../utils/rateLimiter"));
const swagger_1 = require("./swagger");
const metrics_1 = require("../metrics");
const middleware_1 = require("./middleware");
const healthcheck_1 = __importDefault(require("./healthcheck"));
const errorMiddleware_1 = __importDefault(require("../middleware/errorMiddleware"));
const globalLimiter_1 = __importDefault(require("../middleware/globalLimiter"));
const tasks_1 = __importDefault(require("../routes/tasks"));
const taskDrafts_1 = __importDefault(require("../routes/taskDrafts"));
const maps_1 = __importDefault(require("../routes/maps"));
const route_1 = __importDefault(require("../routes/route"));
const routes_1 = __importDefault(require("../routes/routes"));
const optimizer_1 = __importDefault(require("../routes/optimizer"));
const authUser_1 = __importDefault(require("../routes/authUser"));
const users_1 = __importDefault(require("../routes/users"));
const roles_1 = __importDefault(require("../routes/roles"));
const logs_1 = __importDefault(require("../routes/logs"));
const taskTemplates_1 = __importDefault(require("../routes/taskTemplates"));
const storage_1 = __importDefault(require("../routes/storage"));
const files_1 = __importDefault(require("../routes/files"));
const fleets_1 = __importDefault(require("../routes/fleets"));
const departments_1 = __importDefault(require("../routes/departments"));
const employees_1 = __importDefault(require("../routes/employees"));
const tracking_1 = __importDefault(require("../routes/tracking"));
const collections_1 = __importDefault(require("../routes/collections"));
const archives_1 = __importDefault(require("../routes/archives"));
const system_1 = __importDefault(require("../routes/system"));
const routePlans_1 = __importDefault(require("../routes/routePlans"));
const logistics_1 = __importDefault(require("../routes/logistics"));
const analytics_1 = __importDefault(require("../routes/analytics"));
const taskAccess_1 = __importDefault(require("../middleware/taskAccess"));
const problem_1 = require("../utils/problem");
const storage_2 = require("../config/storage");
const service_1 = require("../services/service");
const di_1 = __importDefault(require("../di"));
const tokens_1 = require("../di/tokens");
const auth_service_1 = __importDefault(require("../auth/auth.service"));
const shortLinks_1 = require("../services/shortLinks");
// new imports for access check
const accessMask_1 = require("../utils/accessMask");
const validate = (validations) => [
    ...validations,
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
const INDEX_NONCE_PLACEHOLDER = '__CSP_NONCE__';
const indexCache = new Map();
async function loadIndexTemplate(pub) {
    const filePath = path_1.default.join(pub, 'index.html');
    const fileStat = await (0, promises_1.stat)(filePath);
    const cached = indexCache.get(filePath);
    if (cached && cached.mtimeMs === fileStat.mtimeMs) {
        return cached.html;
    }
    const html = await (0, promises_1.readFile)(filePath, 'utf8');
    indexCache.set(filePath, { html, mtimeMs: fileStat.mtimeMs });
    return html;
}
function injectNonce(template, nonce) {
    if (!template.includes(INDEX_NONCE_PLACEHOLDER)) {
        return template;
    }
    return template.split(INDEX_NONCE_PLACEHOLDER).join(nonce);
}
async function registerRoutes(app, cookieFlags, pub) {
    const csrf = lusca_1.default.csrf({ angular: true, cookie: { options: cookieFlags } });
    const csrfExclude = [
        '/api/v1/auth/send_code',
        '/api/v1/auth/verify_code',
        '/api/v1/csrf',
        '/api/v1/optimizer',
        '/api/v1/maps/expand',
    ];
    const csrfExcludePrefix = ['/api/tma'];
    app.use((req, res, next) => {
        const url = req.originalUrl.split('?')[0];
        if (process.env.DISABLE_CSRF === '1') {
            if (!globalThis.csrfWarn) {
                console.warn('CSRF middleware disabled');
                globalThis.csrfWarn = true;
            }
            return next();
        }
        if (csrfExclude.includes(url) ||
            csrfExcludePrefix.some((p) => url.startsWith(p)) ||
            req.headers.authorization)
            return next();
        // Wrap csrf: convert HTML error responses to application/problem+json for tests
        (function () {
            const _origSend = res.send;
            const _origEnd = res.end;
            let __converted = false;
            function convertIfNeeded(body) {
                var _a;
                const status = Number((_a = res.statusCode) !== null && _a !== void 0 ? _a : 0);
                const headerValue = typeof res.get === 'function'
                    ? res.get('Content-Type')
                    : typeof res.getHeader === 'function'
                        ? res.getHeader('Content-Type')
                        : undefined;
                const contentType = headerValue ? String(headerValue) : '';
                const looksHtml = (typeof body === 'string' && body.trim().startsWith('<')) ||
                    contentType.includes('text/html');
                if (!__converted && status >= 400 && looksHtml) {
                    __converted = true;
                    const targetContentType = 'application/problem+json';
                    if (typeof res.set === 'function') {
                        res.set('Content-Type', targetContentType);
                    }
                    else if (typeof res.setHeader === 'function') {
                        res.setHeader('Content-Type', targetContentType);
                    }
                    const detail = typeof body === 'string' ? body : '';
                    const prob = {
                        type: 'about:blank',
                        title: status === 403 ? 'Ошибка CSRF' : 'Ошибка сервера',
                        status: status,
                        detail: detail,
                    };
                    return JSON.stringify(prob);
                }
                return body;
            }
            if (_origSend) {
                res.send = function (body) {
                    return _origSend.call(this, convertIfNeeded(body));
                };
            }
            if (_origEnd) {
                const endInvoker = _origEnd;
                const invokeEnd = (context, args) => Reflect.apply(endInvoker, context, args);
                res.end = function (chunk, encodingOrCallback, maybeCallback) {
                    const encoding = typeof encodingOrCallback === 'string'
                        ? encodingOrCallback
                        : undefined;
                    const callback = typeof encodingOrCallback === 'function'
                        ? encodingOrCallback
                        : typeof maybeCallback === 'function'
                            ? maybeCallback
                            : undefined;
                    if (chunk !== undefined) {
                        const chunkStr = typeof chunk === 'string'
                            ? chunk
                            : Buffer.isBuffer(chunk)
                                ? chunk.toString(encoding !== null && encoding !== void 0 ? encoding : 'utf8')
                                : undefined;
                        if (typeof chunkStr === 'string') {
                            const converted = convertIfNeeded(chunkStr);
                            if (typeof converted === 'string') {
                                const buffer = Buffer.from(converted, encoding !== null && encoding !== void 0 ? encoding : 'utf8');
                                if (encoding !== undefined && callback !== undefined) {
                                    return invokeEnd(this, [buffer, encoding, callback]);
                                }
                                if (encoding !== undefined) {
                                    return invokeEnd(this, [buffer, encoding]);
                                }
                                if (callback !== undefined) {
                                    return invokeEnd(this, [buffer, callback]);
                                }
                                return invokeEnd(this, [buffer]);
                            }
                        }
                    }
                    if (typeof encodingOrCallback === 'function') {
                        return invokeEnd(this, [chunk, encodingOrCallback]);
                    }
                    if (typeof maybeCallback === 'function') {
                        if (typeof encodingOrCallback === 'string') {
                            return invokeEnd(this, [
                                chunk,
                                encodingOrCallback,
                                maybeCallback,
                            ]);
                        }
                        return invokeEnd(this, [chunk, maybeCallback]);
                    }
                    if (typeof encodingOrCallback === 'string') {
                        return invokeEnd(this, [chunk, encodingOrCallback]);
                    }
                    if (chunk !== undefined) {
                        return invokeEnd(this, [chunk]);
                    }
                    return invokeEnd(this, []);
                };
            }
        })();
        return csrf(req, res, next);
    });
    // --- CORS allowlist (auto-injected) ---
    const __corsOrigins = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const __corsOptions = {
        origin: function (origin, cb) {
            // allow tools/curl without Origin header (origin === undefined)
            if (!origin)
                return cb(null, true); // tighten if needed
            if (__corsOrigins.includes(origin)) {
                return cb(null, true);
            }
            return cb(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],
        maxAge: 600,
    };
    app.use((0, cors_1.default)(__corsOptions));
    // --- end CORS allowlist ---
    const prefix = '/api/v1';
    app.use('/api-docs', swagger_1.swaggerUi.serve, swagger_1.swaggerUi.setup(swagger_1.specs));
    app.use(middleware_1.requestLogger);
    app.use('/api', globalLimiter_1.default);
    const taskStatusRateLimiter = (0, rateLimiter_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 50,
        name: 'task-status',
    });
    const spaRateLimiter = (0, rateLimiter_1.default)({
        windowMs: 60 * 1000,
        max: 50,
        name: 'spa',
    });
    const tmaLoginRateLimiter = (0, rateLimiter_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 20,
        name: 'tma-login',
    });
    const tmaTasksRateLimiter = (0, rateLimiter_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 50,
        name: 'tma-tasks',
    });
    const tmaAuthGuard = di_1.default.resolve(tokens_1.TOKENS.TmaAuthGuard);
    /**
     * @openapi
     * /api/auth/tma-login:
     *   post:
     *     summary: Вход через Telegram Mini App
     *     responses:
     *       200:
     *         description: Токен доступа
     *       401:
     *         $ref: '#/components/responses/Problem'
     */
    app.post('/api/auth/tma-login', tmaLoginRateLimiter, tmaAuthGuard, (0, middleware_1.asyncHandler)(async (_req, res) => {
        const token = await auth_service_1.default.verifyTmaLogin(res.locals.initData);
        res.json({ token });
    }));
    app.get('/health', (0, middleware_1.asyncHandler)(healthcheck_1.default));
    app.get('/metrics', async (_req, res) => {
        res.set('Content-Type', metrics_1.register.contentType);
        res.end(await metrics_1.register.metrics());
    });
    const shortLinkRoute = `${(0, shortLinks_1.getShortLinkPathPrefix)()}/:slug`;
    app.get(shortLinkRoute, (0, middleware_1.asyncHandler)(async (req, res) => {
        const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
        if (!slug) {
            res.status(404).send('Not found');
            return;
        }
        try {
            const target = await (0, shortLinks_1.resolveShortLinkBySlug)(slug);
            if (!target) {
                res.status(404).send('Not found');
                return;
            }
            res.redirect(target);
        }
        catch (error) {
            console.error('Не удалось переадресовать короткую ссылку', error);
            res.status(500).send('Internal Server Error');
        }
    }));
    app.get(`${prefix}/csrf`, csrf, (req, res) => {
        res.json({
            csrfToken: req.csrfToken(),
        });
    });
    app.use(express_1.default.static(path_1.default.join(__dirname, '../../public'), {
        maxAge: '1y',
        immutable: true,
        index: false,
        // Для HTML отключаем кэш, чтобы браузер получал свежий index.html
        setHeaders(res, filePath) {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            }
        },
    }));
    app.use('/uploads', express_1.default.static(storage_2.uploadsDir, {
        maxAge: '1y',
        immutable: true,
        index: false,
    }));
    const initAdmin = (await Promise.resolve().then(() => __importStar(require('../admin/customAdmin')))).default;
    initAdmin(app);
    app.use(`${prefix}/users`, users_1.default);
    app.use(`${prefix}/roles`, roles_1.default);
    app.use(`${prefix}/logs`, logs_1.default);
    app.use(`${prefix}/auth`, authUser_1.default);
    app.use(`${prefix}/maps`, maps_1.default);
    app.use(`${prefix}/route`, route_1.default);
    app.use(`${prefix}/osrm`, route_1.default);
    app.use(`${prefix}/optimizer`, optimizer_1.default);
    app.use(`${prefix}/route-plans`, routePlans_1.default);
    app.use(`${prefix}/logistics`, logistics_1.default);
    app.use(`${prefix}/analytics`, analytics_1.default);
    app.use(`${prefix}/routes`, routes_1.default);
    app.use(`${prefix}/tasks`, tasks_1.default);
    app.use(`${prefix}/task-drafts`, taskDrafts_1.default);
    app.use(`${prefix}/task-templates`, taskTemplates_1.default);
    app.use(`${prefix}/storage`, storage_1.default);
    app.use(`${prefix}/files`, files_1.default);
    app.use(`${prefix}/fleets`, fleets_1.default);
    app.use(`${prefix}/tracking`, tracking_1.default);
    app.use(`${prefix}/departments`, departments_1.default);
    app.use(`${prefix}/employees`, employees_1.default);
    app.use(`${prefix}/collections`, collections_1.default);
    app.use(`${prefix}/archives`, archives_1.default);
    app.use(`${prefix}/system`, system_1.default);
    app.get('/api/tma/tasks', tmaTasksRateLimiter, tmaAuthGuard, (0, middleware_1.asyncHandler)(async (req, res) => {
        var _a;
        const initData = res.locals.initData;
        const userId = Number((_a = initData.user) === null || _a === void 0 ? void 0 : _a.id);
        if (!userId) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка авторизации',
                status: 401,
                detail: 'invalid user',
            });
            return;
        }
        const tasks = await (0, service_1.listMentionedTasks)(userId);
        res.json(tasks);
    }));
    app.patch('/api/tma/tasks/:id/status', tmaTasksRateLimiter, tmaAuthGuard, [(0, express_validator_1.param)('id').isMongoId()], validate([
        (0, express_validator_1.body)('status').isIn(['Новая', 'В работе', 'Выполнена', 'Отменена']),
    ]), (0, middleware_1.asyncHandler)(async (req, res) => {
        var _a, _b;
        const initData = res.locals.initData;
        const userId = Number((_a = initData.user) === null || _a === void 0 ? void 0 : _a.id);
        if (!userId) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Ошибка авторизации',
                status: 401,
                detail: 'invalid user',
            });
            return;
        }
        const task = await (0, service_1.getTask)(req.params.id);
        if (!task) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Задача не найдена',
                status: 404,
                detail: 'Not Found',
            });
            return;
        }
        // actor validation: must be creator/assignee/controller
        const assigneeIds = new Set();
        const controllerIds = new Set();
        const mainAssignee = Number(task.assigned_user_id);
        if (Number.isFinite(mainAssignee)) {
            assigneeIds.add(mainAssignee);
        }
        const extraAssignees = Array.isArray(task.assignees)
            ? task.assignees
            : [];
        extraAssignees
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .forEach((value) => assigneeIds.add(value));
        const mainController = Number(task.controller_user_id);
        if (Number.isFinite(mainController)) {
            controllerIds.add(mainController);
        }
        const extraControllers = Array.isArray(task.controllers)
            ? task.controllers
            : [];
        extraControllers
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .forEach((value) => controllerIds.add(value));
        const actorIds = new Set();
        assigneeIds.forEach((value) => actorIds.add(value));
        controllerIds.forEach((value) => actorIds.add(value));
        const creatorId = Number(task.created_by);
        if (Number.isFinite(creatorId)) {
            actorIds.add(creatorId);
        }
        if (!actorIds.has(userId)) {
            (0, problem_1.sendProblem)(req, res, {
                type: 'about:blank',
                title: 'Доступ запрещён',
                status: 403,
                detail: 'Forbidden',
            });
            return;
        }
        try {
            const updated = await (0, service_1.updateTaskStatus)(req.params.id, req.body.status, userId, { source: 'telegram' });
            if (!updated) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Задача не найдена',
                    status: 404,
                    detail: 'Not Found',
                });
                return;
            }
            await (0, service_1.writeLog)(`Статус задачи ${req.params.id} -> ${req.body.status} пользователем ${userId}`);
            res.json({ status: 'ok', completed_at: (_b = updated.completed_at) !== null && _b !== void 0 ? _b : null });
        }
        catch (error) {
            const err = error;
            if (err.code === 'TASK_STATUS_INVALID') {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Недопустимый статус',
                    status: 409,
                    detail: err.message || 'Статус задачи изменить нельзя',
                });
                return;
            }
            if (err.code === 'TASK_CANCEL_FORBIDDEN' ||
                err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN' ||
                err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN') {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: err.message || 'Нет прав для изменения статуса',
                });
                return;
            }
            throw error;
        }
    }));
    app.patch(`${prefix}/tasks/:id/status`, taskStatusRateLimiter, middleware_1.verifyToken, [(0, express_validator_1.param)('id').isMongoId()], taskAccess_1.default, validate([
        (0, express_validator_1.body)('status').isIn(['Новая', 'В работе', 'Выполнена', 'Отменена']),
    ]), (0, middleware_1.asyncHandler)(async (req, res) => {
        var _a, _b, _c;
        try {
            // compute adminOverride from logged user access mask
            const user = req.user;
            const actorId = Number((_a = user === null || user === void 0 ? void 0 : user.id) !== null && _a !== void 0 ? _a : 0);
            const actorAccess = Number((_b = user === null || user === void 0 ? void 0 : user.access) !== null && _b !== void 0 ? _b : 0);
            const adminOverride = (0, accessMask_1.hasAccess)(actorAccess, accessMask_1.ACCESS_TASK_DELETE);
            const updated = await (0, service_1.updateTaskStatus)(req.params.id, req.body.status, actorId, { source: 'web', adminOverride });
            if (!updated) {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Задача не найдена',
                    status: 404,
                    detail: 'Not Found',
                });
                return;
            }
            await (0, service_1.writeLog)(`Статус задачи ${req.params.id} -> ${req.body.status} пользователем ${actorId}`);
            res.json({ status: 'ok', completed_at: (_c = updated.completed_at) !== null && _c !== void 0 ? _c : null });
        }
        catch (error) {
            const err = error;
            if (err.code === 'TASK_STATUS_INVALID') {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Недопустимый статус',
                    status: 409,
                    detail: err.message || 'Статус задачи изменить нельзя',
                });
                return;
            }
            if (err.code === 'TASK_CANCEL_FORBIDDEN' ||
                err.code === 'TASK_CANCEL_SOURCE_FORBIDDEN' ||
                err.code === 'TASK_REQUEST_CANCEL_FORBIDDEN') {
                (0, problem_1.sendProblem)(req, res, {
                    type: 'about:blank',
                    title: 'Доступ запрещён',
                    status: 403,
                    detail: err.message || 'Нет прав для изменения статуса',
                });
                return;
            }
            throw error;
        }
    }));
    app.get('/', spaRateLimiter, async (_req, res, next) => {
        var _a;
        try {
            const template = await loadIndexTemplate(pub);
            const nonce = String((_a = res.locals.cspNonce) !== null && _a !== void 0 ? _a : '');
            const html = injectNonce(template, nonce);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            next(error);
        }
    });
    app.get('*', spaRateLimiter, async (req, res, next) => {
        var _a;
        // Не отдаём index.html для запросов статических файлов
        if (req.path.includes('.')) {
            res.status(404).end();
            return;
        }
        try {
            const template = await loadIndexTemplate(pub);
            const nonce = String((_a = res.locals.cspNonce) !== null && _a !== void 0 ? _a : '');
            const html = injectNonce(template, nonce);
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        }
        catch (error) {
            next(error);
        }
    });
    app.use(errorMiddleware_1.default);
}
