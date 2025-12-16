"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты шаблонов задач
// Модули: express, controllers/taskTemplates, middleware/auth
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const di_1 = __importDefault(require("../di"));
const taskTemplates_controller_1 = __importDefault(require("../taskTemplates/taskTemplates.controller"));
const auth_1 = __importDefault(require("../middleware/auth"));
const validate_1 = require("../utils/validate");
const router = (0, express_1.Router)();
const ctrl = di_1.default.resolve(taskTemplates_controller_1.default);
router.get('/', (0, auth_1.default)(), ctrl.list);
router.get('/:id', (0, auth_1.default)(), (0, express_validator_1.param)('id').isMongoId(), validate_1.handleValidation, ctrl.detail);
router.post('/', (0, auth_1.default)(), ...ctrl.create);
exports.default = router;
