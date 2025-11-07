"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Назначение: синхронизация задач между вебом и Telegram
// Основные модули: bot, config, db/model, db/queries, services/service, utils/formatTask, utils/taskButtons
require("reflect-metadata");
const tsyringe_1 = require("tsyringe");
const model_1 = require("../db/model");
const config_1 = require("../config");
const service_1 = require("../services/service");
const queries_1 = require("../db/queries");
const formatTask_1 = __importDefault(require("../utils/formatTask"));
const mdEscape_1 = __importDefault(require("../utils/mdEscape"));
const taskButtons_1 = require("../utils/taskButtons");
const taskAlbumLink_1 = require("../utils/taskAlbumLink");
const taskTypeSettings_1 = require("../services/taskTypeSettings");
const taskTelegramMedia_1 = require("../tasks/taskTelegramMedia");
const taskLinks_1 = require("../tasks/taskLinks");
const messageLink_1 = __importDefault(require("../utils/messageLink"));
const delay_1 = __importDefault(require("../utils/delay"));
const taskComments_1 = require("../tasks/taskComments");
const REQUEST_TYPE_NAME = 'Заявка';
const ALBUM_MESSAGE_DELAY_MS = 100;
const selectUserField = (value) => typeof value === 'string' ? value.trim() : '';
const buildUsersIndex = async (ids) => {
    if (!ids.length) {
        return {};
    }
    try {
        const raw = await (0, queries_1.getUsersMap)(ids);
        const entries = Object.entries(raw ?? {}).map(([key, value]) => {
            const name = selectUserField(value?.name) || selectUserField(value?.username);
            const username = selectUserField(value?.username);
            return [key, { name, username }];
        });
        return Object.fromEntries(entries);
    }
    catch (error) {
        console.error('Не удалось получить данные пользователей задачи', error);
        return {};
    }
};
const isMessageNotModifiedError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const descriptionSource = typeof candidate.response?.description === 'string'
        ? candidate.response.description
        : typeof candidate.description === 'string'
            ? candidate.description
            : '';
    const description = descriptionSource.toLowerCase();
    return (candidate.response?.error_code === 400 &&
        description.includes('message is not modified'));
};
const isMessageMissingOnEditError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const errorCode = candidate.response?.error_code ??
        (typeof candidate.error_code === 'number' ? candidate.error_code : null);
    if (errorCode !== 400) {
        return false;
    }
    const descriptionSource = typeof candidate.response?.description === 'string'
        ? candidate.response.description
        : typeof candidate.description === 'string'
            ? candidate.description
            : '';
    return descriptionSource.toLowerCase().includes('message to edit not found');
};
const isMessageMissingOnDeleteError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    const errorCode = candidate.response?.error_code ??
        (typeof candidate.error_code === 'number' ? candidate.error_code : null);
    if (errorCode !== 400) {
        return false;
    }
    const descriptionSource = typeof candidate.response?.description === 'string'
        ? candidate.response.description
        : typeof candidate.description === 'string'
            ? candidate.description
            : '';
    return descriptionSource.toLowerCase().includes('message to delete not found');
};
const toNumericId = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};
const normalizeMessageIdList = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => {
            if (typeof item === 'number' && Number.isFinite(item)) {
                return item;
            }
            if (typeof item === 'string') {
                const parsed = Number(item.trim());
                return Number.isFinite(parsed) ? parsed : null;
            }
            return null;
        })
            .filter((item) => item !== null);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return [value];
    }
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
            return [parsed];
        }
    }
    return [];
};
const normalizeChatId = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    return undefined;
};
const resolveChatId = () => typeof config_1.getChatId === 'function' ? (0, config_1.getChatId)() : config_1.chatId;
const areChatsEqual = (left, right) => normalizeChatId(left) === normalizeChatId(right);
const areTopicsEqual = (left, right) => {
    if (typeof left === 'number' && typeof right === 'number') {
        return left === right;
    }
    const leftUnset = left === null || typeof left === 'undefined';
    const rightUnset = right === null || typeof right === 'undefined';
    return leftUnset && rightUnset;
};
const buildPhotoAlbumIntro = (task, options) => {
    const title = typeof task.title === 'string' ? task.title.trim() : '';
    const text = title
        ? `*${(0, mdEscape_1.default)(title)}*`
        : 'Фото по задаче';
    const messageLink = options.messageLink ?? null;
    const inlineKeyboard = messageLink
        ? [[{ text: 'Перейти к задаче', url: messageLink }]]
        : [];
    const replyMarkup = inlineKeyboard.length
        ? { inline_keyboard: inlineKeyboard }
        : undefined;
    const sendOptions = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
    if (typeof options.topicId === 'number') {
        sendOptions.message_thread_id = options.topicId;
    }
    return { text, options: sendOptions };
};
const collectUserIds = (task) => {
    const ids = new Set();
    const register = (value) => {
        if (!value) {
            return;
        }
        if (typeof value === 'object') {
            const record = value;
            if ('telegram_id' in record) {
                register(record.telegram_id);
            }
            if ('user_id' in record) {
                register(record.user_id);
            }
            if ('id' in record) {
                register(record.id);
            }
            return;
        }
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric !== 0) {
            ids.add(numeric);
        }
    };
    register(task.assigned_user_id);
    if (task && typeof task === 'object' && 'assigned_user' in task) {
        const assigned = task.assigned_user;
        if (assigned && typeof assigned === 'object') {
            const record = assigned;
            if ('telegram_id' in record) {
                register(record.telegram_id);
            }
            else if ('id' in record) {
                register(record.id);
            }
        }
    }
    if (Array.isArray(task.assignees)) {
        task.assignees.forEach(register);
    }
    register(task.controller_user_id);
    if (Array.isArray(task.controllers)) {
        task.controllers.forEach(register);
    }
    register(task.transport_driver_id);
    if (task && typeof task === 'object' && 'transport_driver' in task) {
        register(task.transport_driver);
    }
    register(task.created_by);
    return Array.from(ids);
};
const loadTaskPlain = async (taskId, override) => {
    if (override) {
        if (typeof override.toObject === 'function') {
            return override.toObject();
        }
        return override;
    }
    const fresh = await (0, service_1.getTask)(taskId);
    if (!fresh) {
        return null;
    }
    if (typeof fresh.toObject === 'function') {
        return fresh.toObject();
    }
    return fresh;
};
let TaskSyncController = (() => {
    let _classDecorators = [(0, tsyringe_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var TaskSyncController = _classThis = class {
        constructor(bot) {
            this.bot = bot;
            this.mediaHelper = new taskTelegramMedia_1.TaskTelegramMedia(this.bot, {
                baseAppUrl: config_1.appUrl || '',
            });
        }
        async onWebTaskUpdate(taskId, override) {
            await this.syncAfterChange(taskId, override);
        }
        async onTelegramAction(taskId, status, userId) {
            const updated = await (0, service_1.updateTaskStatus)(taskId, status, userId, {
                source: 'telegram',
            });
            if (!updated) {
                return null;
            }
            await this.syncAfterChange(taskId, updated);
            return loadTaskPlain(taskId, updated);
        }
        async syncAfterChange(taskId, override) {
            await this.updateTaskMessage(taskId, override);
        }
        async updateTaskMessage(taskId, override) {
            const targetChatId = resolveChatId();
            if (!targetChatId)
                return;
            const task = await loadTaskPlain(taskId, override);
            if (!task)
                return;
            const messageId = toNumericId(task.telegram_message_id);
            const configuredTopicId = await (0, taskTypeSettings_1.resolveTaskTypeTopicId)(task.task_type);
            const topicId = toNumericId(task.telegram_topic_id) ??
                (typeof configuredTopicId === 'number' ? configuredTopicId : null);
            const normalizedTopicId = typeof topicId === 'number' ? topicId : undefined;
            const status = typeof task.status === 'string'
                ? task.status
                : undefined;
            const userIds = collectUserIds(task);
            const users = await buildUsersIndex(userIds);
            const formatted = (0, formatTask_1.default)(task, users);
            const { text, inlineImages, sections } = formatted;
            const appLink = (0, taskLinks_1.buildTaskAppLink)(task);
            const normalizedGroupChatId = normalizeChatId(targetChatId);
            const chatIdForLinks = normalizedGroupChatId ??
                (typeof targetChatId === 'string' || typeof targetChatId === 'number'
                    ? targetChatId
                    : undefined);
            let albumLinkForKeyboard = (0, taskAlbumLink_1.resolveTaskAlbumLink)(task, {
                fallbackChatId: chatIdForLinks,
                fallbackTopicId: typeof topicId === 'number' ? topicId : null,
            });
            const photosTarget = await (0, taskTypeSettings_1.resolveTaskTypePhotosTarget)(task.task_type);
            const configuredPhotosChatId = normalizeChatId(photosTarget?.chatId);
            const configuredPhotosTopicId = toNumericId(photosTarget?.topicId) ?? undefined;
            const previousPhotosChatId = normalizeChatId(task.telegram_photos_chat_id);
            const previousPhotosMessageId = toNumericId(task.telegram_photos_message_id);
            const previousCommentMessageId = toNumericId(task.telegram_comment_message_id);
            let commentMessageId = previousCommentMessageId ?? undefined;
            let shouldDeletePreviousComment = false;
            const resolvedKind = (() => {
                const rawKind = typeof task.kind === 'string' ? task.kind.trim().toLowerCase() : '';
                if (rawKind === 'task' || rawKind === 'request') {
                    return rawKind;
                }
                const typeValue = typeof task.task_type === 'string' ? task.task_type.trim() : '';
                return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
            })();
            const replyMarkup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind: resolvedKind }, {
                ...(albumLinkForKeyboard ? { albumLink: albumLinkForKeyboard } : {}),
                showCommentButton: true,
            });
            const options = {
                parse_mode: 'MarkdownV2',
                link_preview_options: { is_disabled: true },
                ...(typeof normalizedTopicId === 'number'
                    ? { message_thread_id: normalizedTopicId }
                    : {}),
                ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            };
            const media = this.mediaHelper.collectSendableAttachments(task, inlineImages);
            const previousPreviewMessageIds = normalizeMessageIdList(task.telegram_preview_message_ids);
            const previousAttachmentMessageIds = normalizeMessageIdList(task.telegram_attachments_message_ids);
            let mediaMessagesDeleted = false;
            const ensurePreviousMediaRemoved = async () => {
                if (mediaMessagesDeleted) {
                    return;
                }
                mediaMessagesDeleted = true;
                const attachmentsChatId = previousPhotosChatId ?? targetChatId;
                if (attachmentsChatId) {
                    if (previousPreviewMessageIds.length) {
                        await this.mediaHelper.deleteAttachmentMessages(attachmentsChatId, previousPreviewMessageIds);
                    }
                    if (previousAttachmentMessageIds.length) {
                        await this.mediaHelper.deleteAttachmentMessages(attachmentsChatId, previousAttachmentMessageIds);
                    }
                    if (previousPhotosMessageId) {
                        try {
                            await this.bot.telegram.deleteMessage(attachmentsChatId, previousPhotosMessageId);
                        }
                        catch (error) {
                            if (!isMessageMissingOnDeleteError(error)) {
                                console.error('Не удалось удалить предыдущее сообщение альбома задачи', error);
                            }
                        }
                    }
                }
            };
            let currentMessageId = messageId;
            const editReplyMarkup = typeof this.bot?.telegram?.editMessageReplyMarkup === 'function'
                ? this.bot.telegram.editMessageReplyMarkup.bind(this.bot.telegram)
                : null;
            if (currentMessageId !== null) {
                try {
                    await this.bot.telegram.editMessageText(targetChatId, currentMessageId, undefined, text, options);
                }
                catch (error) {
                    if (isMessageNotModifiedError(error)) {
                        try {
                            await this.bot.telegram.editMessageReplyMarkup(targetChatId, currentMessageId, undefined, replyMarkup);
                        }
                        catch (markupError) {
                            if (isMessageNotModifiedError(markupError)) {
                                // Клавиатура уже соответствует актуальному состоянию
                            }
                            else if (isMessageMissingOnEditError(markupError)) {
                                await ensurePreviousMediaRemoved();
                                currentMessageId = null;
                            }
                            else {
                                console.error('Не удалось обновить клавиатуру задачи после повторного применения', markupError);
                            }
                        }
                    }
                    else {
                        try {
                            await this.bot.telegram.deleteMessage(targetChatId, currentMessageId);
                        }
                        catch (deleteError) {
                            if (isMessageMissingOnDeleteError(deleteError)) {
                                console.info('Устаревшее сообщение задачи уже удалено в Telegram', { chatId: targetChatId, messageId: currentMessageId });
                            }
                            else {
                                console.warn('Не удалось удалить устаревшее сообщение задачи', deleteError);
                            }
                        }
                        await ensurePreviousMediaRemoved();
                        currentMessageId = null;
                        shouldDeletePreviousComment = true;
                        commentMessageId = undefined;
                    }
                }
            }
            else {
                await ensurePreviousMediaRemoved();
                if (typeof previousCommentMessageId === 'number') {
                    shouldDeletePreviousComment = true;
                    commentMessageId = undefined;
                }
            }
            let previewMessageIds = [];
            let attachmentMessageIds = [];
            let sentMessageId;
            let photosChatId;
            let photosMessageId;
            let photosTopicId;
            if (currentMessageId === null) {
                try {
                    const attachmentsChatValue = configuredPhotosChatId ?? targetChatId ?? normalizedGroupChatId;
                    const normalizedAttachmentsChatId = normalizeChatId(attachmentsChatValue);
                    const attachmentsTopicIdForSend = (() => {
                        if (typeof configuredPhotosTopicId === 'number') {
                            return configuredPhotosTopicId;
                        }
                        if (normalizedAttachmentsChatId &&
                            !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId)) {
                            return undefined;
                        }
                        return normalizedTopicId;
                    })();
                    const useSeparatePhotosChat = Boolean(normalizedAttachmentsChatId &&
                        !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId));
                    const useSeparatePhotosTopic = typeof attachmentsTopicIdForSend === 'number' &&
                        !areTopicsEqual(attachmentsTopicIdForSend, normalizedTopicId);
                    const shouldSendAttachmentsSeparately = Boolean(normalizedAttachmentsChatId &&
                        (useSeparatePhotosChat || useSeparatePhotosTopic));
                    const sendResult = await this.mediaHelper.sendTaskMessageWithPreview(targetChatId, text, Array.isArray(sections) ? sections : [], media, replyMarkup, normalizedTopicId, { skipAlbum: shouldSendAttachmentsSeparately });
                    sentMessageId = sendResult.messageId;
                    previewMessageIds = sendResult.previewMessageIds ?? [];
                    if (!shouldSendAttachmentsSeparately &&
                        Array.isArray(sendResult.previewMessageIds) &&
                        sendResult.previewMessageIds.length > 0) {
                        const albumMessageId = sendResult.previewMessageIds[0];
                        if (typeof albumMessageId === 'number') {
                            albumLinkForKeyboard = (0, messageLink_1.default)(chatIdForLinks, albumMessageId, normalizedTopicId);
                        }
                    }
                    if (sentMessageId) {
                        const messageLinkForAttachments = (0, messageLink_1.default)(chatIdForLinks, sentMessageId, normalizedTopicId);
                        const consumed = new Set(sendResult.consumedAttachmentUrls ?? []);
                        const extras = shouldSendAttachmentsSeparately
                            ? media.extras
                            : consumed.size
                                ? media.extras.filter((attachment) => attachment.kind === 'image'
                                    ? !consumed.has(attachment.url)
                                    : true)
                                : media.extras;
                        let albumIntroMessageId;
                        if (extras.length) {
                            const shouldSendAlbumIntro = shouldSendAttachmentsSeparately;
                            let albumMessageId;
                            if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
                                const intro = buildPhotoAlbumIntro(task, {
                                    appLink,
                                    messageLink: messageLinkForAttachments,
                                    topicId: attachmentsTopicIdForSend ?? undefined,
                                });
                                try {
                                    const response = await this.bot.telegram.sendMessage(normalizedAttachmentsChatId, intro.text, intro.options);
                                    if (response?.message_id) {
                                        albumMessageId = response.message_id;
                                        albumIntroMessageId = response.message_id;
                                        albumLinkForKeyboard =
                                            (0, messageLink_1.default)(normalizedAttachmentsChatId, albumMessageId, attachmentsTopicIdForSend) ?? albumLinkForKeyboard;
                                    }
                                }
                                catch (error) {
                                    console.error('Не удалось отправить описание альбома задачи', error);
                                }
                            }
                            const shouldReplyToGroup = Boolean(normalizedAttachmentsChatId &&
                                areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId) &&
                                areTopicsEqual(attachmentsTopicIdForSend, typeof topicId === 'number' ? topicId : undefined));
                            if (attachmentsChatValue) {
                                try {
                                    attachmentMessageIds =
                                        await this.mediaHelper.sendTaskAttachments(attachmentsChatValue, extras, attachmentsTopicIdForSend, albumMessageId
                                            ? albumMessageId
                                            : shouldReplyToGroup
                                                ? sentMessageId
                                                : undefined, sendResult.cache);
                                    if (typeof albumMessageId === 'number' &&
                                        normalizedAttachmentsChatId) {
                                        photosMessageId = albumMessageId;
                                        photosChatId = normalizedAttachmentsChatId;
                                        photosTopicId =
                                            typeof attachmentsTopicIdForSend === 'number'
                                                ? attachmentsTopicIdForSend
                                                : undefined;
                                        albumLinkForKeyboard =
                                            (0, messageLink_1.default)(normalizedAttachmentsChatId, albumMessageId, attachmentsTopicIdForSend) ?? albumLinkForKeyboard;
                                    }
                                }
                                catch (error) {
                                    console.error('Не удалось отправить вложения задачи', error);
                                }
                            }
                        }
                        if (editReplyMarkup) {
                            if (typeof albumIntroMessageId === 'number' &&
                                normalizedAttachmentsChatId) {
                                await (0, delay_1.default)(ALBUM_MESSAGE_DELAY_MS);
                            }
                            const updatedMarkup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind: resolvedKind }, {
                                ...(albumLinkForKeyboard ? { albumLink: albumLinkForKeyboard } : {}),
                                showCommentButton: true,
                            });
                            try {
                                await editReplyMarkup(targetChatId, sentMessageId, undefined, updatedMarkup);
                            }
                            catch (error) {
                                if (!isMessageNotModifiedError(error)) {
                                    console.error('Не удалось обновить клавиатуру задачи ссылкой на альбом', error);
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('Не удалось отправить сообщение задачи в Telegram', error);
                    return;
                }
            }
            else {
                await ensurePreviousMediaRemoved();
                sentMessageId = currentMessageId;
                const attachmentsToSend = [];
                const consumedUrls = new Set();
                if (media.previewImage?.url) {
                    attachmentsToSend.push(media.previewImage);
                    consumedUrls.add(media.previewImage.url);
                }
                const extras = consumedUrls.size
                    ? media.extras.filter((attachment) => attachment.kind === 'image'
                        ? !consumedUrls.has(attachment.url)
                        : true)
                    : media.extras;
                attachmentsToSend.push(...extras);
                if (attachmentsToSend.length) {
                    const attachmentsChatValue = configuredPhotosChatId ?? targetChatId ?? normalizedGroupChatId;
                    const normalizedAttachmentsChatId = normalizeChatId(attachmentsChatValue);
                    const attachmentsTopicIdForSend = typeof configuredPhotosTopicId === 'number'
                        ? configuredPhotosTopicId
                        : normalizedAttachmentsChatId &&
                            !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId)
                            ? undefined
                            : normalizedTopicId;
                    const useSeparatePhotosChat = Boolean(normalizedAttachmentsChatId &&
                        !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId));
                    const useSeparatePhotosTopic = typeof attachmentsTopicIdForSend === 'number' &&
                        !areTopicsEqual(attachmentsTopicIdForSend, normalizedTopicId);
                    const shouldSendAlbumIntro = Boolean(normalizedAttachmentsChatId &&
                        (useSeparatePhotosChat || useSeparatePhotosTopic));
                    let albumMessageId;
                    if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
                        const intro = buildPhotoAlbumIntro(task, {
                            appLink,
                            messageLink: (0, messageLink_1.default)(chatIdForLinks, sentMessageId, normalizedTopicId),
                            topicId: attachmentsTopicIdForSend ?? undefined,
                        });
                        try {
                            const response = await this.bot.telegram.sendMessage(normalizedAttachmentsChatId, intro.text, intro.options);
                            if (response?.message_id) {
                                albumMessageId = response.message_id;
                                albumLinkForKeyboard =
                                    (0, messageLink_1.default)(normalizedAttachmentsChatId, albumMessageId, attachmentsTopicIdForSend) ?? albumLinkForKeyboard;
                            }
                        }
                        catch (error) {
                            console.error('Не удалось отправить описание альбома задачи', error);
                        }
                    }
                    const shouldReplyToGroup = Boolean(normalizedAttachmentsChatId &&
                        areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId) &&
                        areTopicsEqual(attachmentsTopicIdForSend, normalizedTopicId));
                    if (attachmentsChatValue) {
                        try {
                            const sentIds = await this.mediaHelper.sendTaskAttachments(attachmentsChatValue, attachmentsToSend, attachmentsTopicIdForSend, albumMessageId
                                ? albumMessageId
                                : shouldReplyToGroup
                                    ? sentMessageId
                                    : undefined);
                            const previewCount = media.previewImage?.url ? 1 : 0;
                            if (previewCount > 0) {
                                previewMessageIds = sentIds.slice(0, previewCount);
                                attachmentMessageIds = sentIds.slice(previewCount);
                            }
                            else {
                                attachmentMessageIds = sentIds;
                            }
                            if (typeof albumMessageId === 'number' &&
                                normalizedAttachmentsChatId) {
                                photosMessageId = albumMessageId;
                                photosChatId = normalizedAttachmentsChatId;
                                photosTopicId =
                                    typeof attachmentsTopicIdForSend === 'number'
                                        ? attachmentsTopicIdForSend
                                        : undefined;
                                albumLinkForKeyboard =
                                    (0, messageLink_1.default)(normalizedAttachmentsChatId, albumMessageId, attachmentsTopicIdForSend) ?? albumLinkForKeyboard;
                            }
                        }
                        catch (error) {
                            console.error('Не удалось обновить вложения задачи', error);
                        }
                        if (!shouldSendAlbumIntro && previewMessageIds.length) {
                            const albumTargetId = previewMessageIds[0];
                            if (typeof albumTargetId === 'number') {
                                albumLinkForKeyboard = (0, messageLink_1.default)(attachmentsChatValue, albumTargetId, attachmentsTopicIdForSend);
                            }
                        }
                    }
                }
                if (sentMessageId && editReplyMarkup) {
                    const updatedMarkup = (0, taskButtons_1.taskStatusInlineMarkup)(taskId, status, { kind: resolvedKind }, {
                        ...(albumLinkForKeyboard ? { albumLink: albumLinkForKeyboard } : {}),
                        showCommentButton: true,
                    });
                    try {
                        await editReplyMarkup(targetChatId, sentMessageId, undefined, updatedMarkup);
                    }
                    catch (error) {
                        if (!isMessageNotModifiedError(error)) {
                            console.error('Не удалось обновить клавиатуру задачи ссылкой на альбом', error);
                        }
                    }
                }
            }
            if (shouldDeletePreviousComment && typeof previousCommentMessageId === 'number') {
                try {
                    await (0, taskComments_1.syncCommentMessage)({
                        bot: this.bot,
                        chatId: targetChatId,
                        topicId: normalizedTopicId,
                        messageId: previousCommentMessageId,
                        commentHtml: '',
                        detectors: {
                            missingOnDelete: isMessageMissingOnDeleteError,
                        },
                    });
                }
                catch (error) {
                    if (!isMessageMissingOnDeleteError(error)) {
                        console.error('Не удалось удалить устаревший комментарий задачи', error);
                    }
                }
            }
            const baseMessageId = typeof sentMessageId === 'number'
                ? sentMessageId
                : typeof messageId === 'number'
                    ? messageId
                    : undefined;
            const commentContent = typeof task.comment === 'string' ? task.comment : '';
            if (typeof baseMessageId === 'number') {
                try {
                    const commentHtml = (0, taskComments_1.ensureCommentHtml)(commentContent);
                    commentMessageId = await (0, taskComments_1.syncCommentMessage)({
                        bot: this.bot,
                        chatId: targetChatId,
                        topicId: normalizedTopicId,
                        replyTo: baseMessageId,
                        messageId: commentMessageId,
                        commentHtml,
                        detectors: {
                            notModified: isMessageNotModifiedError,
                            missingOnEdit: isMessageMissingOnEditError,
                            missingOnDelete: isMessageMissingOnDeleteError,
                        },
                    });
                }
                catch (error) {
                    console.error('Не удалось синхронизировать комментарий задачи', error);
                    commentMessageId = previousCommentMessageId ?? undefined;
                }
            }
            else if (typeof commentMessageId === 'number') {
                try {
                    await (0, taskComments_1.syncCommentMessage)({
                        bot: this.bot,
                        chatId: targetChatId,
                        topicId: normalizedTopicId,
                        messageId: commentMessageId,
                        commentHtml: '',
                        detectors: {
                            missingOnDelete: isMessageMissingOnDeleteError,
                        },
                    });
                    commentMessageId = undefined;
                }
                catch (error) {
                    if (isMessageMissingOnDeleteError(error)) {
                        commentMessageId = undefined;
                    }
                    else {
                        console.error('Не удалось удалить сообщение комментария задачи', error);
                        commentMessageId = previousCommentMessageId ?? commentMessageId;
                    }
                }
            }
            const setPayload = {};
            const unsetPayload = {
                telegram_summary_message_id: '',
                telegram_status_message_id: '',
            };
            if (sentMessageId) {
                setPayload.telegram_message_id = sentMessageId;
            }
            else {
                unsetPayload.telegram_message_id = '';
            }
            if (previewMessageIds.length) {
                setPayload.telegram_preview_message_ids = previewMessageIds;
            }
            else {
                unsetPayload.telegram_preview_message_ids = '';
            }
            if (attachmentMessageIds.length) {
                setPayload.telegram_attachments_message_ids = attachmentMessageIds;
            }
            else {
                unsetPayload.telegram_attachments_message_ids = '';
            }
            if (typeof photosMessageId === 'number' && photosChatId) {
                setPayload.telegram_photos_message_id = photosMessageId;
                setPayload.telegram_photos_chat_id = photosChatId;
                if (typeof photosTopicId === 'number') {
                    setPayload.telegram_photos_topic_id = photosTopicId;
                }
                else {
                    unsetPayload.telegram_photos_topic_id = '';
                }
            }
            else {
                unsetPayload.telegram_photos_message_id = '';
                unsetPayload.telegram_photos_chat_id = '';
                unsetPayload.telegram_photos_topic_id = '';
            }
            if (typeof commentMessageId === 'number') {
                setPayload.telegram_comment_message_id = commentMessageId;
            }
            else {
                unsetPayload.telegram_comment_message_id = '';
            }
            const updatePayload = {};
            if (Object.keys(setPayload).length) {
                updatePayload.$set = setPayload;
            }
            if (Object.keys(unsetPayload).length) {
                updatePayload.$unset = unsetPayload;
            }
            if (Object.keys(updatePayload).length) {
                try {
                    await model_1.Task.updateOne({ _id: taskId }, updatePayload).exec();
                }
                catch (error) {
                    console.error('Не удалось обновить данные Telegram задачи', error);
                }
            }
        }
    };
    __setFunctionName(_classThis, "TaskSyncController");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        TaskSyncController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return TaskSyncController = _classThis;
})();
exports.default = TaskSyncController;
