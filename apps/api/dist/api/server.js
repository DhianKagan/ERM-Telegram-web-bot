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
exports.buildApp = buildApp;
// Назначение файла: сборка HTTP API.
// Основные модули: express, security, routes
const config_1 = __importDefault(require("../config"));
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
const connect_mongo_1 = __importDefault(require("connect-mongo"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const util_1 = require("util");
const security_1 = __importDefault(require("./security"));
const routes_1 = __importDefault(require("./routes"));
const diskSpace_1 = require("../services/diskSpace");
const sanitizeError_1 = __importDefault(require("../utils/sanitizeError"));
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection in API:', (0, sanitizeError_1.default)(err));
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception in API:', (0, sanitizeError_1.default)(err));
    process.exit(1);
});
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const sessionSecret = process.env.SESSION_SECRET ?? '';
if (!sessionSecret) {
    throw new Error('Переменная SESSION_SECRET не задана');
}
async function buildApp() {
    const { default: connect } = await Promise.resolve().then(() => __importStar(require('../db/connection')));
    await connect();
    await Promise.resolve().then(() => __importStar(require('../db/model')));
    const app = (0, express_1.default)();
    const ext = process.env.NODE_ENV === 'production' ? '.js' : '.ts';
    const traceModule = await Promise.resolve(`${'../middleware/trace' + ext}`).then(s => __importStar(require(s)));
    const pinoLoggerModule = await Promise.resolve(`${'../middleware/pinoLogger' + ext}`).then(s => __importStar(require(s)));
    const metricsModule = await Promise.resolve(`${'../middleware/metrics' + ext}`).then(s => __importStar(require(s)));
    const trace = (traceModule.default || traceModule);
    const pinoLogger = (pinoLoggerModule.default ||
        pinoLoggerModule);
    const metrics = (metricsModule.default ||
        metricsModule);
    (0, security_1.default)(app);
    app.use(trace);
    app.use(pinoLogger);
    app.use(metrics);
    const root = path_1.default.join(__dirname, '../..');
    const pub = path_1.default.join(root, 'public');
    const indexFile = path_1.default.join(pub, 'index.html');
    let needBuild = false;
    try {
        const st = await fs_1.promises.stat(indexFile);
        if (st.size === 0)
            needBuild = true;
    }
    catch {
        needBuild = true;
    }
    if (needBuild) {
        console.log('Сборка интерфейса...');
        await execAsync('pnpm run build-client', { cwd: root });
    }
    app.set('trust proxy', 1);
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use((0, compression_1.default)());
    const domain = process.env.NODE_ENV === 'production'
        ? config_1.default.cookieDomain || new URL(config_1.default.appUrl).hostname
        : undefined;
    const secureCookie = process.env.COOKIE_SECURE !== 'false';
    const cookieFlags = {
        httpOnly: true,
        // По умолчанию cookie передаются только по HTTPS;
        // переменная COOKIE_SECURE=false включает HTTP для локальной отладки.
        secure: secureCookie,
        sameSite: secureCookie ? 'none' : 'lax',
        ...(domain ? { domain } : {}),
    };
    const sessionOpts = {
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: { ...cookieFlags, maxAge: 7 * 24 * 60 * 60 * 1000 },
    };
    if (process.env.NODE_ENV !== 'test') {
        sessionOpts.store = connect_mongo_1.default.create({
            mongoUrl: config_1.default.mongoUrl,
            collectionName: 'sessions',
        });
    }
    app.use((0, express_session_1.default)(sessionOpts));
    await (0, routes_1.default)(app, cookieFlags, pub);
    if (process.env.NODE_ENV !== 'test') {
        (0, diskSpace_1.startDiskMonitor)();
    }
    return app;
}
exports.default = buildApp;
