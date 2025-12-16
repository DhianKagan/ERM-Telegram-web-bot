"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Роуты управления файлами в хранилище
// Модули: express, express-validator, middleware/auth, auth/roles, services/dataStorage
const express_1 = require("express");
const auth_1 = __importDefault(require("../middleware/auth"));
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = __importDefault(require("../auth/roles.guard"));
const accessMask_1 = require("../utils/accessMask");
const dataStorage_1 = require("../services/dataStorage");
const express_validator_1 = require("express-validator");
const middleware_1 = require("../api/middleware");
const di_1 = __importDefault(require("../di"));
const tokens_1 = require("../di/tokens");
const queries_1 = require("../db/queries");
const router = (0, express_1.Router)();
const diagnosticsController = di_1.default.resolve(tokens_1.TOKENS.StorageDiagnosticsController);
const taskSyncController = di_1.default.resolve(tokens_1.TOKENS.TaskSyncController);
router.get('/', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, [
    (0, express_validator_1.query)('userId').optional().isInt(),
    (0, express_validator_1.query)('type').optional().isString(),
], async (req, res) => {
    const filters = {
        userId: req.query.userId ? Number(req.query.userId) : undefined,
        type: req.query.type,
    };
    const files = await (0, dataStorage_1.listFiles)(filters);
    res.json(files);
});
router.get('/:id([0-9a-fA-F]{24})', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, express_validator_1.param)('id').isMongoId(), async (req, res) => {
    const file = await (0, dataStorage_1.getFile)(req.params.id);
    if (!file) {
        res.status(404).json({ error: 'Файл не найден' });
        return;
    }
    res.json(file);
});
router.delete('/:id([0-9a-fA-F]{24})', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, express_validator_1.param)('id').isMongoId(), async (req, res, next) => {
    var _a;
    try {
        const deletionResult = await (0, dataStorage_1.deleteFile)(req.params.id);
        if (deletionResult === null || deletionResult === void 0 ? void 0 : deletionResult.taskId) {
            const normalizedUserId = typeof ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) === 'number' && Number.isFinite(req.user.id)
                ? req.user.id
                : undefined;
            const attachmentsForSync = deletionResult.attachments !== undefined
                ? deletionResult.attachments
                : [];
            try {
                await (0, queries_1.syncTaskAttachments)(deletionResult.taskId, attachmentsForSync, normalizedUserId);
            }
            catch (syncError) {
                console.error('Не удалось обновить вложения задачи после удаления файла через Storage', syncError);
            }
            try {
                await taskSyncController.syncAfterChange(deletionResult.taskId);
            }
            catch (telegramError) {
                console.error('Не удалось синхронизировать задачу в Telegram после удаления файла через Storage', telegramError);
            }
        }
        res.json({ ok: true });
    }
    catch (error) {
        const err = error;
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Файл не найден' });
        }
        else {
            next(error);
        }
    }
});
router.get('/diagnostics', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(diagnosticsController.diagnose));
router.post('/diagnostics/fix', (0, auth_1.default)(), (0, roles_decorator_1.Roles)(accessMask_1.ACCESS_ADMIN), roles_guard_1.default, (0, middleware_1.asyncHandler)(diagnosticsController.remediate));
exports.default = router;
