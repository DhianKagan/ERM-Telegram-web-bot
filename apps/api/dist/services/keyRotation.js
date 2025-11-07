"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKeyRotation = startKeyRotation;
exports.stopKeyRotation = stopKeyRotation;
// Назначение: планировщик пересоздания ключей
// Модули: node-cron, secretsManager
const node_cron_1 = require("node-cron");
const secretsManager_1 = require("./secretsManager");
let task;
function startKeyRotation() {
    const expr = process.env.KEY_ROTATION_CRON || '0 0 * * *';
    const name = process.env.AWS_SECRET_ID || process.env.VAULT_SECRET_PATH;
    if (!name)
        return;
    task = (0, node_cron_1.schedule)(expr, async () => {
        await (0, secretsManager_1.rotateSecret)(name);
    });
}
function stopKeyRotation() {
    task?.stop();
    task = undefined;
}
