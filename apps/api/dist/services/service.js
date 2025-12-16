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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.listMentionedTasks = exports.searchTasks = exports.listLogs = exports.writeLog = exports.getUser = exports.updateRole = exports.getRole = exports.listRoles = exports.updateUser = exports.removeUser = exports.listUsers = exports.createUser = exports.updateTaskStatus = exports.updateTask = exports.getTask = void 0;
// Сервис для управления сущностями MongoDB через единый набор функций
// Модули: db/queries, wgLogEngine
const q = __importStar(require("../db/queries"));
const wgLogEngine_1 = require("./wgLogEngine");
Object.defineProperty(exports, "writeLog", { enumerable: true, get: function () { return wgLogEngine_1.writeLog; } });
exports.getTask = q.getTask;
exports.updateTask = q.updateTask;
exports.updateTaskStatus = q.updateTaskStatus;
exports.createUser = q.createUser;
exports.listUsers = q.listUsers;
exports.removeUser = q.removeUser;
exports.updateUser = q.updateUser;
exports.listRoles = q.listRoles;
exports.getRole = q.getRole;
exports.updateRole = q.updateRole;
exports.getUser = q.getUser;
const listLogs = (params) => (0, wgLogEngine_1.listLogs)(params);
exports.listLogs = listLogs;
exports.searchTasks = q.searchTasks;
exports.listMentionedTasks = q.listMentionedTasks;
exports.deleteTask = q.deleteTask;
