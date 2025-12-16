"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Employee = void 0;
// Назначение файла: модель коллекции сотрудников
// Основные модули: mongoose
const mongoose_1 = require("mongoose");
const employeeSchema = new mongoose_1.Schema({
    departmentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    divisionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CollectionItem' },
    positionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CollectionItem' },
    name: { type: String, required: true },
});
exports.Employee = (0, mongoose_1.model)('Employee', employeeSchema);
