"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_1 = require("../db/model");
const attachments_1 = require("../utils/attachments");
const dataStorage_1 = require("../services/dataStorage");
const wgLogEngine_1 = require("../services/wgLogEngine");
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizePayload = (payload) => {
    if (!isPlainObject(payload)) {
        return {};
    }
    return { ...payload };
};
const normalizeAttachments = (value) => {
    const parsed = (0, attachments_1.coerceAttachments)(value);
    return Array.isArray(parsed) ? parsed : [];
};
const objectIdSet = (ids) => new Set(ids.map((id) => id.toHexString()));
class TaskDraftsService {
    async getDraft(userId, kind) {
        return model_1.TaskDraft.findOne({ userId, kind }).lean();
    }
    async saveDraft(userId, kind, payload) {
        const normalizedPayload = normalizePayload(payload);
        const attachments = normalizeAttachments(normalizedPayload.attachments);
        normalizedPayload.attachments = attachments;
        normalizedPayload.kind = kind;
        const existing = await model_1.TaskDraft.findOne({ userId, kind });
        const previousIds = existing
            ? (0, attachments_1.extractAttachmentIds)(existing.attachments || [])
            : [];
        const draft = await model_1.TaskDraft.findOneAndUpdate({ userId, kind }, { $set: { payload: normalizedPayload, attachments } }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }).exec();
        if (!draft) {
            throw new Error('Не удалось сохранить черновик');
        }
        const newIds = (0, attachments_1.extractAttachmentIds)(attachments);
        if (newIds.length > 0) {
            await model_1.File.updateMany({ _id: { $in: newIds }, userId }, { $set: { draftId: draft._id } }).exec();
        }
        const previousSet = objectIdSet(previousIds);
        const currentSet = objectIdSet(newIds);
        const removedIds = Array.from(previousSet).filter((id) => !currentSet.has(id));
        await Promise.all(removedIds.map(async (id) => {
            try {
                await (0, dataStorage_1.deleteFile)(id);
            }
            catch (error) {
                const err = error;
                if (err.code !== 'ENOENT') {
                    await (0, wgLogEngine_1.writeLog)('Ошибка удаления файла черновика', 'warn', {
                        fileId: id,
                        error: err?.message || String(error),
                    }).catch(() => undefined);
                }
            }
        }));
        return draft;
    }
    async deleteDraft(userId, kind) {
        const draft = await model_1.TaskDraft.findOneAndDelete({ userId, kind }).exec();
        if (!draft)
            return;
        const ids = (0, attachments_1.extractAttachmentIds)(draft.attachments || []);
        if (ids.length === 0) {
            return;
        }
        const relatedFiles = await model_1.File.find({ _id: { $in: ids } })
            .select(['_id', 'taskId'])
            .lean()
            .catch(() => []);
        const attachedIds = new Set(relatedFiles
            .filter((doc) => doc.taskId)
            .map((doc) => String(doc._id)));
        await Promise.all(ids.map(async (id) => {
            const idHex = id.toHexString();
            if (attachedIds.has(idHex)) {
                await model_1.File.updateOne({ _id: id }, { $unset: { draftId: '' } })
                    .exec()
                    .catch(() => undefined);
                return;
            }
            try {
                await (0, dataStorage_1.deleteFile)(idHex);
            }
            catch (error) {
                const err = error;
                if (err.code !== 'ENOENT') {
                    await (0, wgLogEngine_1.writeLog)('Ошибка удаления вложения черновика', 'warn', {
                        fileId: idHex,
                        error: err?.message || String(error),
                    }).catch(() => undefined);
                }
            }
        }));
    }
}
exports.default = TaskDraftsService;
