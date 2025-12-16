"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Department = void 0;
// Назначение файла: модель коллекции департаментов
// Основные модули: mongoose
const mongoose_1 = require("mongoose");
const departmentSchema = new mongoose_1.Schema({
    fleetId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Fleet', required: true },
    name: { type: String, required: true },
});
exports.Department = (0, mongoose_1.model)('Department', departmentSchema);
