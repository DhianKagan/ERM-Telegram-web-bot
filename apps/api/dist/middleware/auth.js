"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authMiddleware;
const middleware_1 = require("../api/middleware");
function authMiddleware() {
    return (req, res, next) => (0, middleware_1.verifyToken)(req, res, next);
}
