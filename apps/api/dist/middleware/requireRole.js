"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = requireRole;
// Назначение: обёртка вокруг checkRole для проверки роли
// Основные модули: middleware/checkRole
const checkRole_1 = __importDefault(require("./checkRole"));
function requireRole(role) {
    return (0, checkRole_1.default)(role);
}
