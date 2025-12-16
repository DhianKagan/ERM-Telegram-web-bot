"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = shouldLog;
const patterns = [
    { regex: /^\/api\/v1\/tasks/, methods: ['POST', 'PATCH', 'DELETE'] },
    { regex: /^\/api\/v1\/auth\/profile$/, methods: ['PATCH'] },
    { regex: /^\/api\/auth\/tma-login$/, methods: ['POST'] },
    { regex: /^\/api\/v1\/auth\/verify_code$/, methods: ['POST'] },
];
function shouldLog(req) {
    if (req.originalUrl.startsWith('/api/v1/logs'))
        return false;
    return patterns.some(({ regex, methods }) => regex.test(req.originalUrl) && methods.includes(req.method));
}
