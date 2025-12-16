"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = applySecurity;
const helmet_1 = __importDefault(require("helmet"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = __importDefault(require("../config"));
const parseList = (env) => env
    ? env
        .split(/[ ,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
function applySecurity(app) {
    const reportOnly = process.env.CSP_REPORT_ONLY !== 'false';
    app.use((_, res, next) => {
        res.locals.cspNonce = node_crypto_1.default.randomBytes(16).toString('base64');
        next();
    });
    const connectSrc = [
        "'self'",
        'https://router.project-osrm.org',
        ...parseList(process.env.CSP_CONNECT_SRC_ALLOWLIST),
    ];
    try {
        connectSrc.push(new URL(config_1.default.routingUrl).origin);
    }
    catch {
        // Игнорируем некорректный routingUrl
    }
    const imgSrc = [
        "'self'",
        'data:',
        ...parseList(process.env.CSP_IMG_SRC_ALLOWLIST),
    ];
    const scriptSrc = [
        "'self'",
        (_req, res) => `'nonce-${res.locals.cspNonce}'`,
        'https://telegram.org',
        ...parseList(process.env.CSP_SCRIPT_SRC_ALLOWLIST),
    ];
    const styleSrc = [
        "'self'",
        "'unsafe-inline'",
        ...parseList(process.env.CSP_STYLE_SRC_ALLOWLIST),
    ];
    const fontSrc = ["'self'", ...parseList(process.env.CSP_FONT_SRC_ALLOWLIST)];
    const workerSrc = [
        "'self'",
        'blob:',
        ...parseList(process.env.CSP_WORKER_SRC_ALLOWLIST),
    ];
    const directives = {
        'frame-src': ["'self'", 'https://oauth.telegram.org'],
        'script-src': scriptSrc,
        'style-src': styleSrc,
        'font-src': fontSrc,
        'img-src': imgSrc,
        'connect-src': connectSrc,
        'worker-src': workerSrc,
    };
    if (reportOnly)
        directives['upgrade-insecure-requests'] = null;
    else
        directives['upgrade-insecure-requests'] = [];
    const reportUri = process.env.CSP_REPORT_URI;
    if (reportUri)
        directives['report-uri'] = [reportUri];
    const csp = {
        useDefaults: true,
        directives,
        reportOnly,
    };
    app.use((0, helmet_1.default)({
        hsts: true,
        noSniff: true,
        referrerPolicy: { policy: 'no-referrer' },
        frameguard: { action: 'deny' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: csp,
    }));
}
