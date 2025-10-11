// Назначение: синхронизация задач между вебом и Telegram
// Основные модули: bot, config, db/model, db/queries, services/service, utils/formatTask, utils/taskButtons
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Context, Telegraf } from 'telegraf';
import type { TaskDocument } from '../db/model';
import { TOKENS } from '../di/tokens';
import { Task } from '../db/model';
import { chatId, appUrl as baseAppUrl } from '../config';
import { getTask, updateTaskStatus } from '../services/service';
import { getUsersMap } from '../db/queries';
import formatTask from '../utils/formatTask';
import escapeMarkdownV2 from '../utils/mdEscape';
import { taskStatusInlineMarkup } from '../utils/taskButtons';
import type { Task as SharedTask, User } from 'shared';
import {
  resolveTaskTypeTopicId,
  resolveTaskTypePhotosTarget,
} from '../services/taskTypeSettings';
import { TaskTelegramMedia } from '../tasks/taskTelegramMedia';
import { getTaskIdentifier } from '../tasks/taskMessages';
import { buildTaskAppLink } from '../tasks/taskLinks';
import buildChatMessageLink from '../utils/messageLink';

type UsersIndex = Record<number | string, Pick<User, 'name' | 'username'>>;

const REQUEST_TYPE_NAME = 'Заявка';

const selectUserField = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const buildUsersIndex = async (ids: number[]): Promise<UsersIndex> => {
  if (!ids.length) {
    return {};
  }
  try {
    const raw = await getUsersMap(ids);
    const entries = Object.entries(raw ?? {}).map(([key, value]) => {
      const name = selectUserField(value?.name) || selectUserField(value?.username);
      const username = selectUserField(value?.username);
      return [key, { name, username } satisfies Pick<User, 'name' | 'username'>];
    });
    return Object.fromEntries(entries) as UsersIndex;
  } catch (error) {
    console.error('Не удалось получить данные пользователей задачи', error);
    return {};
  }
};

const isMessageNotModifiedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as Record<string, unknown> & {
    response?: { error_code?: number; description?: unknown };
    description?: unknown;
  };
  const descriptionSource =
    typeof candidate.response?.description === 'string'
      ? candidate.response.description
      : typeof candidate.description === 'string'
        ? candidate.description
        : '';
  const description = descriptionSource.toLowerCase();
  return (
    candidate.response?.error_code === 400 &&
    description.includes('message is not modified')
  );
};

const isMessageMissingOnEditError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as Record<string, unknown> & {
    response?: { error_code?: number; description?: unknown };
    description?: unknown;
    error_code?: unknown;
  };
  const errorCode =
    candidate.response?.error_code ??
    (typeof candidate.error_code === 'number' ? candidate.error_code : null);
  if (errorCode !== 400) {
    return false;
  }
  const descriptionSource =
    typeof candidate.response?.description === 'string'
      ? candidate.response.description
      : typeof candidate.description === 'string'
        ? candidate.description
        : '';
  return descriptionSource.toLowerCase().includes('message to edit not found');
};

const isMessageMissingOnDeleteError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as Record<string, unknown> & {
    response?: { error_code?: number; description?: unknown };
    description?: unknown;
    error_code?: unknown;
  };
  const errorCode =
    candidate.response?.error_code ??
    (typeof candidate.error_code === 'number' ? candidate.error_code : null);
  if (errorCode !== 400) {
    return false;
  }
  const descriptionSource =
    typeof candidate.response?.description === 'string'
      ? candidate.response.description
      : typeof candidate.description === 'string'
        ? candidate.description
        : '';
  return descriptionSource.toLowerCase().includes('message to delete not found');
};

const toNumericId = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeMessageIdList = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return (value as unknown[])
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
      .filter((item): item is number => item !== null);
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

const normalizeChatId = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
};

const areChatsEqual = (left?: unknown, right?: unknown): boolean =>
  normalizeChatId(left) === normalizeChatId(right);

const areTopicsEqual = (
  left?: number | null,
  right?: number | null,
): boolean => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right;
  }
  const leftUnset = left === null || typeof left === 'undefined';
  const rightUnset = right === null || typeof right === 'undefined';
  return leftUnset && rightUnset;
};

type TelegramSendMessageOptions = Parameters<
  Telegraf['telegram']['sendMessage']
>[2];

const buildPhotoAlbumIntro = (
  task: Partial<PlainTask>,
  options: {
    appLink?: string | null;
    topicId?: number | null;
    messageLink?: string | null;
  },
): { text: string; options: TelegramSendMessageOptions } => {
  const identifier = getTaskIdentifier(task as TaskDocument);
  const title =
    typeof task.title === 'string' ? task.title.trim() : '';
  const headerParts: string[] = [];
  if (identifier) {
    headerParts.push(`№ ${escapeMarkdownV2(identifier)}`);
  }
  if (title) {
    headerParts.push(`*${escapeMarkdownV2(title)}*`);
  }
  const header = headerParts.length
    ? `📸 ${headerParts.join(' — ')}`
    : '📸 Фото по задаче';
  const descriptionCandidates = [
    typeof task.task_description === 'string'
      ? task.task_description.trim()
      : '',
    typeof (task as Record<string, unknown>).description === 'string'
      ? ((task as Record<string, unknown>).description as string).trim()
      : '',
  ];
  const description = descriptionCandidates.find((value) => Boolean(value)) ?? '';
  const lines = [header];
  if (description) {
    lines.push(escapeMarkdownV2(description));
  } else {
    lines.push('Описание отсутствует.');
  }
  const text = lines.join('\n\n');
  const inlineKeyboard: { text: string; url: string }[][] = [];
  const messageLink = options.messageLink ?? null;
  const appLink = options.appLink ?? null;
  if (messageLink) {
    inlineKeyboard.push([{ text: 'Перейти к сообщению', url: messageLink }]);
  }
  if (appLink && appLink !== messageLink) {
    inlineKeyboard.push([{ text: 'Открыть в вебе', url: appLink }]);
  }
  const replyMarkup = inlineKeyboard.length
    ? { inline_keyboard: inlineKeyboard }
    : undefined;
  const sendOptions: TelegramSendMessageOptions = {
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
  if (typeof options.topicId === 'number') {
    sendOptions.message_thread_id = options.topicId;
  }
  return { text, options: sendOptions };
};

type PlainTask = TaskDocument & Record<string, unknown>;

const collectUserIds = (task: Partial<PlainTask>): number[] => {
  const ids = new Set<number>();
  const register = (value: unknown) => {
    if (!value) {
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
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
    const assigned = (task as Record<string, unknown>).assigned_user;
    if (assigned && typeof assigned === 'object') {
      const record = assigned as Record<string, unknown>;
      if ('telegram_id' in record) {
        register(record.telegram_id);
      } else if ('id' in record) {
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
  register(task.created_by);
  return Array.from(ids);
};

const loadTaskPlain = async (
  taskId: string,
  override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null,
): Promise<PlainTask | null> => {
  if (override) {
    if (typeof (override as { toObject?: () => unknown }).toObject === 'function') {
      return (override as { toObject(): unknown }).toObject() as PlainTask;
    }
    return override as PlainTask;
  }
  const fresh = await getTask(taskId);
  if (!fresh) {
    return null;
  }
  if (typeof (fresh as { toObject?: () => unknown }).toObject === 'function') {
    return (fresh as { toObject(): unknown }).toObject() as PlainTask;
  }
  return (fresh as unknown) as PlainTask;
};

@injectable()
export default class TaskSyncController {
  private readonly mediaHelper: TaskTelegramMedia;

  constructor(
    @inject(TOKENS.BotInstance) private readonly bot: Telegraf<Context>,
  ) {
    this.mediaHelper = new TaskTelegramMedia(this.bot, {
      baseAppUrl: baseAppUrl || '',
    });
  }

  async onWebTaskUpdate(
    taskId: string,
    override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null,
  ): Promise<void> {
    await this.syncAfterChange(taskId, override);
  }

  async onTelegramAction(
    taskId: string,
    status: TaskDocument['status'],
    userId: number,
  ): Promise<PlainTask | null> {
    const updated = await updateTaskStatus(taskId, status, userId, {
      source: 'telegram',
    });
    if (!updated) {
      return null;
    }
    await this.syncAfterChange(taskId, updated);
    return loadTaskPlain(taskId, updated);
  }

  async syncAfterChange(
    taskId: string,
    override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null,
  ): Promise<void> {
    await this.updateTaskMessage(taskId, override);
  }

  private async updateTaskMessage(
    taskId: string,
    override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null,
  ): Promise<void> {
    const targetChatId = chatId;
    if (!targetChatId) return;
    const task = await loadTaskPlain(taskId, override);
    if (!task) return;

    const messageId = toNumericId(task.telegram_message_id);
    const configuredTopicId = await resolveTaskTypeTopicId(task.task_type);
    const topicId =
      toNumericId(task.telegram_topic_id) ??
      (typeof configuredTopicId === 'number' ? configuredTopicId : null);
    const status =
      typeof task.status === 'string'
        ? (task.status as SharedTask['status'])
        : undefined;
    const userIds = collectUserIds(task);
    const users = await buildUsersIndex(userIds);
    const formatted = formatTask(task as unknown as SharedTask, users);
    const { text, inlineImages, sections } = formatted;
    const appLink = buildTaskAppLink(task);
    const normalizedGroupChatId = normalizeChatId(targetChatId);
    const chatIdForLinks =
      normalizedGroupChatId ??
      (typeof targetChatId === 'string' || typeof targetChatId === 'number'
        ? targetChatId
        : undefined);
    const photosTarget = await resolveTaskTypePhotosTarget(task.task_type);
    const configuredPhotosChatId = normalizeChatId(photosTarget?.chatId);
    const configuredPhotosTopicId = toNumericId(photosTarget?.topicId) ?? undefined;
    const previousPhotosChatId = normalizeChatId(task.telegram_photos_chat_id);
    const previousPhotosMessageId = toNumericId(
      task.telegram_photos_message_id,
    );
    const resolvedKind = (() => {
      const rawKind =
        typeof task.kind === 'string' ? task.kind.trim().toLowerCase() : '';
      if (rawKind === 'task' || rawKind === 'request') {
        return rawKind;
      }
      const typeValue =
        typeof task.task_type === 'string' ? task.task_type.trim() : '';
      return typeValue === REQUEST_TYPE_NAME ? 'request' : 'task';
    })();
    const replyMarkup = taskStatusInlineMarkup(taskId, status, {
      kind: resolvedKind,
    });

    const options: Parameters<typeof this.bot.telegram.editMessageText>[4] = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };

    const media = this.mediaHelper.collectSendableAttachments(
      task,
      inlineImages,
    );
    const previousPreviewMessageIds = normalizeMessageIdList(
      task.telegram_preview_message_ids,
    );
    const previousAttachmentMessageIds = normalizeMessageIdList(
      task.telegram_attachments_message_ids,
    );

    let mediaMessagesDeleted = false;
    const ensurePreviousMediaRemoved = async () => {
      if (mediaMessagesDeleted) {
        return;
      }
      mediaMessagesDeleted = true;
      const attachmentsChatId = previousPhotosChatId ?? targetChatId;
      if (attachmentsChatId) {
        if (previousPreviewMessageIds.length) {
          await this.mediaHelper.deleteAttachmentMessages(
            attachmentsChatId,
            previousPreviewMessageIds,
          );
        }
        if (previousAttachmentMessageIds.length) {
          await this.mediaHelper.deleteAttachmentMessages(
            attachmentsChatId,
            previousAttachmentMessageIds,
          );
        }
        if (previousPhotosMessageId) {
          try {
            await this.bot.telegram.deleteMessage(
              attachmentsChatId,
              previousPhotosMessageId,
            );
          } catch (error) {
            if (!isMessageMissingOnDeleteError(error)) {
              console.error(
                'Не удалось удалить предыдущее сообщение альбома задачи',
                error,
              );
            }
          }
        }
      }
    };

    let currentMessageId = messageId;

    if (currentMessageId !== null) {
      try {
        await this.bot.telegram.editMessageText(
          targetChatId,
          currentMessageId,
          undefined,
          text,
          options,
        );
      } catch (error) {
        if (isMessageNotModifiedError(error)) {
          try {
            await this.bot.telegram.editMessageReplyMarkup(
              targetChatId,
              currentMessageId,
              undefined,
              replyMarkup,
            );
          } catch (markupError) {
            if (isMessageNotModifiedError(markupError)) {
              // Клавиатура уже соответствует актуальному состоянию
            } else if (isMessageMissingOnEditError(markupError)) {
              await ensurePreviousMediaRemoved();
              currentMessageId = null;
            } else {
              console.error(
                'Не удалось обновить клавиатуру задачи после повторного применения',
                markupError,
              );
            }
          }
        } else {
          try {
            await this.bot.telegram.deleteMessage(
              targetChatId,
              currentMessageId,
            );
          } catch (deleteError) {
            if (isMessageMissingOnDeleteError(deleteError)) {
              console.info(
                'Устаревшее сообщение задачи уже удалено в Telegram',
                { chatId: targetChatId, messageId: currentMessageId },
              );
            } else {
              console.warn(
                'Не удалось удалить устаревшее сообщение задачи',
                deleteError,
              );
            }
          }
          await ensurePreviousMediaRemoved();
          currentMessageId = null;
        }
      }
    } else {
      await ensurePreviousMediaRemoved();
    }

    let previewMessageIds: number[] = [];
    let attachmentMessageIds: number[] = [];
    let sentMessageId: number | undefined;
    let photosChatId: string | undefined;
    let photosMessageId: number | undefined;
    let photosTopicId: number | undefined;

    if (currentMessageId === null) {
      try {
        const attachmentsChatValue =
          configuredPhotosChatId ?? targetChatId ?? normalizedGroupChatId;
        const normalizedAttachmentsChatId = normalizeChatId(
          attachmentsChatValue,
        );
        const normalizedTopicId =
          typeof topicId === 'number' ? topicId : undefined;
        const attachmentsTopicIdForSend = (() => {
          if (typeof configuredPhotosTopicId === 'number') {
            return configuredPhotosTopicId;
          }
          if (
            normalizedAttachmentsChatId &&
            !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId)
          ) {
            return undefined;
          }
          return normalizedTopicId;
        })();
        const useSeparatePhotosChat = Boolean(
          normalizedAttachmentsChatId &&
            !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId),
        );
        const useSeparatePhotosTopic =
          typeof attachmentsTopicIdForSend === 'number' &&
          !areTopicsEqual(attachmentsTopicIdForSend, normalizedTopicId);
        const shouldSendAttachmentsSeparately = Boolean(
          normalizedAttachmentsChatId &&
            (useSeparatePhotosChat || useSeparatePhotosTopic),
        );

        const sendResult = await this.mediaHelper.sendTaskMessageWithPreview(
          targetChatId,
          text,
          Array.isArray(sections) ? sections : [],
          media,
          replyMarkup,
          normalizedTopicId,
          { skipAlbum: shouldSendAttachmentsSeparately },
        );
        sentMessageId = sendResult.messageId;
        previewMessageIds = sendResult.previewMessageIds ?? [];
        if (sentMessageId) {
          const messageLinkForAttachments = buildChatMessageLink(
            chatIdForLinks,
            sentMessageId,
            normalizedTopicId,
          );
          const consumed = new Set(sendResult.consumedAttachmentUrls ?? []);
          const extras = shouldSendAttachmentsSeparately
            ? media.extras
            : consumed.size
              ? media.extras.filter((attachment) =>
                  attachment.kind === 'image'
                    ? !consumed.has(attachment.url)
                    : true,
                )
              : media.extras;
          if (extras.length) {
            const shouldSendAlbumIntro = shouldSendAttachmentsSeparately;
            let albumMessageId: number | undefined;
            if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
              const intro = buildPhotoAlbumIntro(task, {
                appLink,
                messageLink: messageLinkForAttachments,
                topicId: attachmentsTopicIdForSend ?? undefined,
              });
              try {
                const response = await this.bot.telegram.sendMessage(
                  normalizedAttachmentsChatId,
                  intro.text,
                  intro.options,
                );
                if (response?.message_id) {
                  albumMessageId = response.message_id;
                }
              } catch (error) {
                console.error(
                  'Не удалось отправить описание альбома задачи',
                  error,
                );
              }
            }
            const shouldReplyToGroup = Boolean(
              normalizedAttachmentsChatId &&
                areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId) &&
                areTopicsEqual(
                  attachmentsTopicIdForSend,
                  typeof topicId === 'number' ? topicId : undefined,
                ),
            );
            if (attachmentsChatValue) {
              try {
                attachmentMessageIds =
                  await this.mediaHelper.sendTaskAttachments(
                    attachmentsChatValue,
                    extras,
                    attachmentsTopicIdForSend,
                    albumMessageId
                      ? albumMessageId
                      : shouldReplyToGroup
                        ? sentMessageId
                        : undefined,
                    sendResult.cache,
                  );
                if (
                  typeof albumMessageId === 'number' &&
                  normalizedAttachmentsChatId
                ) {
                  photosMessageId = albumMessageId;
                  photosChatId = normalizedAttachmentsChatId;
                  photosTopicId =
                    typeof attachmentsTopicIdForSend === 'number'
                      ? attachmentsTopicIdForSend
                      : undefined;
                }
              } catch (error) {
                console.error('Не удалось отправить вложения задачи', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Не удалось отправить сообщение задачи в Telegram', error);
        return;
      }
    } else {
      await ensurePreviousMediaRemoved();
      sentMessageId = currentMessageId;
      const attachmentsToSend = [] as Parameters<
        TaskTelegramMedia['sendTaskAttachments']
      >[1];
      const consumedUrls = new Set<string>();
      if (media.previewImage?.url) {
        attachmentsToSend.push(media.previewImage);
        consumedUrls.add(media.previewImage.url);
      }
      const extras = consumedUrls.size
        ? media.extras.filter((attachment) =>
            attachment.kind === 'image'
              ? !consumedUrls.has(attachment.url)
              : true,
          )
        : media.extras;
      attachmentsToSend.push(...extras);
      if (attachmentsToSend.length) {
        const attachmentsChatValue =
          configuredPhotosChatId ?? targetChatId ?? normalizedGroupChatId;
        const normalizedAttachmentsChatId = normalizeChatId(
          attachmentsChatValue,
        );
        const normalizedTopicId =
          typeof topicId === 'number' ? topicId : undefined;
        const attachmentsTopicIdForSend =
          typeof configuredPhotosTopicId === 'number'
            ? configuredPhotosTopicId
            : normalizedAttachmentsChatId &&
                !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId)
              ? undefined
              : normalizedTopicId;
        const useSeparatePhotosChat = Boolean(
          normalizedAttachmentsChatId &&
            !areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId),
        );
        const useSeparatePhotosTopic =
          typeof attachmentsTopicIdForSend === 'number' &&
          !areTopicsEqual(attachmentsTopicIdForSend, normalizedTopicId);
        const shouldSendAlbumIntro = Boolean(
          normalizedAttachmentsChatId &&
            (useSeparatePhotosChat || useSeparatePhotosTopic),
        );
        let albumMessageId: number | undefined;
        if (shouldSendAlbumIntro && normalizedAttachmentsChatId) {
          const intro = buildPhotoAlbumIntro(task, {
            appLink,
            messageLink: buildChatMessageLink(
              chatIdForLinks,
              sentMessageId,
              normalizedTopicId,
            ),
            topicId: attachmentsTopicIdForSend ?? undefined,
          });
          try {
            const response = await this.bot.telegram.sendMessage(
              normalizedAttachmentsChatId,
              intro.text,
              intro.options,
            );
            if (response?.message_id) {
              albumMessageId = response.message_id;
            }
          } catch (error) {
            console.error(
              'Не удалось отправить описание альбома задачи',
              error,
            );
          }
        }
        const shouldReplyToGroup = Boolean(
          normalizedAttachmentsChatId &&
            areChatsEqual(normalizedAttachmentsChatId, normalizedGroupChatId) &&
            areTopicsEqual(
              attachmentsTopicIdForSend,
              normalizedTopicId,
            ),
        );
        if (attachmentsChatValue) {
          try {
            const sentIds = await this.mediaHelper.sendTaskAttachments(
              attachmentsChatValue,
              attachmentsToSend,
              attachmentsTopicIdForSend,
              albumMessageId
                ? albumMessageId
                : shouldReplyToGroup
                  ? sentMessageId
                  : undefined,
            );
            const previewCount = media.previewImage?.url ? 1 : 0;
            if (previewCount > 0) {
              previewMessageIds = sentIds.slice(0, previewCount);
              attachmentMessageIds = sentIds.slice(previewCount);
            } else {
              attachmentMessageIds = sentIds;
            }
            if (
              typeof albumMessageId === 'number' &&
              normalizedAttachmentsChatId
            ) {
              photosMessageId = albumMessageId;
              photosChatId = normalizedAttachmentsChatId;
              photosTopicId =
                typeof attachmentsTopicIdForSend === 'number'
                  ? attachmentsTopicIdForSend
                  : undefined;
            }
          } catch (error) {
            console.error('Не удалось обновить вложения задачи', error);
          }
        }
      }
    }

    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {
      telegram_summary_message_id: '',
      telegram_status_message_id: '',
    };

    if (sentMessageId) {
      setPayload.telegram_message_id = sentMessageId;
    } else {
      unsetPayload.telegram_message_id = '';
    }
    if (previewMessageIds.length) {
      setPayload.telegram_preview_message_ids = previewMessageIds;
    } else {
      unsetPayload.telegram_preview_message_ids = '';
    }
    if (attachmentMessageIds.length) {
      setPayload.telegram_attachments_message_ids = attachmentMessageIds;
    } else {
      unsetPayload.telegram_attachments_message_ids = '';
    }
    if (typeof photosMessageId === 'number' && photosChatId) {
      setPayload.telegram_photos_message_id = photosMessageId;
      setPayload.telegram_photos_chat_id = photosChatId;
      if (typeof photosTopicId === 'number') {
        setPayload.telegram_photos_topic_id = photosTopicId;
      } else {
        unsetPayload.telegram_photos_topic_id = '';
      }
    } else {
      unsetPayload.telegram_photos_message_id = '';
      unsetPayload.telegram_photos_chat_id = '';
      unsetPayload.telegram_photos_topic_id = '';
    }

    const updatePayload: Record<string, unknown> = {};
    if (Object.keys(setPayload).length) {
      updatePayload.$set = setPayload;
    }
    if (Object.keys(unsetPayload).length) {
      updatePayload.$unset = unsetPayload;
    }
    if (Object.keys(updatePayload).length) {
      try {
        await Task.updateOne({ _id: taskId }, updatePayload).exec();
      } catch (error) {
        console.error('Не удалось обновить данные Telegram задачи', error);
      }
    }
  }

}
