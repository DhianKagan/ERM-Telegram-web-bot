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
import taskStatusKeyboard from '../utils/taskButtons';
import type { Task as SharedTask, User } from 'shared';
import { resolveTaskTypeTopicId } from '../services/taskTypeSettings';
import { TaskTelegramMedia } from '../tasks/taskTelegramMedia';

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

type PlainTask = TaskDocument & Record<string, unknown>;

const collectUserIds = (task: Partial<PlainTask>): number[] => {
  const ids = new Set<number>();
  const register = (value: unknown) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric !== 0) {
      ids.add(numeric);
    }
  };
  register(task.assigned_user_id);
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
    const updated = await updateTaskStatus(taskId, status, userId);
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
    if (!chatId) return;
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
    const { text, inlineImages } = formatted;
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
    const keyboard = taskStatusKeyboard(taskId, status, {
      kind: resolvedKind,
    });
    const replyMarkup = keyboard.reply_markup ?? undefined;

    const options: Parameters<typeof this.bot.telegram.editMessageText>[4] = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };

    if (messageId !== null) {
      try {
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          text,
          options,
        );
        return;
      } catch (error) {
        if (isMessageNotModifiedError(error)) {
          return;
        }
        try {
          await this.bot.telegram.deleteMessage(chatId, messageId);
        } catch (deleteError) {
          if (isMessageMissingOnDeleteError(deleteError)) {
            console.info(
              'Устаревшее сообщение задачи уже удалено в Telegram',
              { chatId, messageId },
            );
          } else {
            console.warn(
              'Не удалось удалить устаревшее сообщение задачи',
              deleteError,
            );
          }
        }
      }
    }

    const media = this.mediaHelper.collectSendableAttachments(
      task,
      inlineImages,
    );
    let previewMessageIds: number[] = [];
    let attachmentMessageIds: number[] = [];
    let sentMessageId: number | undefined;

    try {
      const sendResult = await this.mediaHelper.sendTaskMessageWithPreview(
        chatId,
        text,
        media,
        replyMarkup,
        typeof topicId === 'number' ? topicId : undefined,
      );
      sentMessageId = sendResult.messageId;
      previewMessageIds = sendResult.previewMessageIds ?? [];
      if (sentMessageId) {
        const consumed = new Set(sendResult.consumedAttachmentUrls ?? []);
        const extras = consumed.size
          ? media.extras.filter((attachment) =>
              attachment.kind === 'image'
                ? !consumed.has(attachment.url)
                : true,
            )
          : media.extras;
        if (extras.length) {
          try {
            attachmentMessageIds = await this.mediaHelper.sendTaskAttachments(
              chatId,
              extras,
              typeof topicId === 'number' ? topicId : undefined,
              sentMessageId,
              sendResult.cache,
            );
          } catch (error) {
            console.error('Не удалось отправить вложения задачи', error);
          }
        }
      }
    } catch (error) {
      console.error('Не удалось отправить сообщение задачи в Telegram', error);
      return;
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
