"use strict";
// Назначение: точка входа общего пакета.
// Модули: constants, taskFields, mapUtils, types, taskFormSchema
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskFormSchema = exports.generateMultiRouteLink = exports.generateRouteLink = exports.extractCoords = exports.taskFields = void 0;
__exportStar(require("./constants"), exports);
var taskFields_1 = require("./taskFields");
Object.defineProperty(exports, "taskFields", { enumerable: true, get: function () { return taskFields_1.taskFields; } });
var mapUtils_1 = require("./mapUtils");
Object.defineProperty(exports, "extractCoords", { enumerable: true, get: function () { return mapUtils_1.extractCoords; } });
Object.defineProperty(exports, "generateRouteLink", { enumerable: true, get: function () { return mapUtils_1.generateRouteLink; } });
Object.defineProperty(exports, "generateMultiRouteLink", { enumerable: true, get: function () { return mapUtils_1.generateMultiRouteLink; } });
var taskForm_schema_json_1 = require("./taskForm.schema.json");
Object.defineProperty(exports, "taskFormSchema", { enumerable: true, get: function () { return __importDefault(taskForm_schema_json_1).default; } });
