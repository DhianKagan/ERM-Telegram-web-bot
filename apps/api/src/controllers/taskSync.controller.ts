// Назначение: синхронизация задач между вебом и Telegram
// Основные модули: bot, config, db/model, db/queries, services/service, tasks/taskHistory.service, utils/formatTask, utils/taskButtons
import 'reflect-metadata';
import { injectable } from 'tsyringe';
import type { Context, Telegraf } from 'telegraf';
import type { TaskDocument } from '../db/model';
import { Task } from '../db/model';
import { chatId } from '../config';
import { getTask, updateTaskStatus } from '../services/service';
import { getUsersMap } from '../db/queries';
import formatTask from '../utils/formatTask';
import taskStatusKeyboard from '../utils/taskButtons';
import {
  getTaskHistoryMessage,
  updateTaskHistoryMessageId,
} from '../tasks/taskHistory.service';
import type { Task as SharedTask, User } from 'shared';

type UsersIndex = Record<number | string, Pick<User, 'name' | 'username'>>;

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
  constructor(private readonly bot: Telegraf<Context>) {}

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
    await Promise.allSettled([
      this.updateTaskMessage(taskId, override),
      this.updateHistoryMessage(taskId),
    ]);
  }

  private async updateTaskMessage(
    taskId: string,
    override?: TaskDocument | (TaskDocument & Record<string, unknown>) | null,
  ): Promise<void> {
    if (!chatId) return;
    const task = await loadTaskPlain(taskId, override);
    if (!task) return;

    const messageId = toNumericId(task.telegram_message_id);
    const topicId = toNumericId(task.telegram_topic_id);
    const status =
      typeof task.status === 'string'
        ? (task.status as SharedTask['status'])
        : undefined;
    const userIds = collectUserIds(task);
    const users = await buildUsersIndex(userIds);
    const { text } = formatTask(task as unknown as SharedTask, users);
    const keyboard = taskStatusKeyboard(taskId, status);
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
          console.warn(
            'Не удалось удалить устаревшее сообщение задачи',
            deleteError,
          );
        }
      }
    }

    const sendOptions: Parameters<typeof this.bot.telegram.sendMessage>[2] = {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };

    try {
      const sent = await this.bot.telegram.sendMessage(chatId, text, sendOptions);
      if (sent?.message_id) {
        await Task.updateOne(
          { _id: taskId },
          {
            $set: { telegram_message_id: sent.message_id },
            $unset: {
              telegram_summary_message_id: '',
              telegram_status_message_id: '',
            },
          },
        ).catch((error) => {
          console.error(
            'Не удалось обновить идентификатор сообщения задачи',
            error,
          );
        });
      }
    } catch (error) {
      console.error('Не удалось отправить сообщение задачи в Telegram', error);
    }
  }

  private async updateHistoryMessage(taskId: string): Promise<void> {
    if (!chatId) return;
    try {
      const payload = await getTaskHistoryMessage(taskId);
      if (!payload) return;
      const { messageId, text, topicId } = payload;
      const options: Parameters<typeof this.bot.telegram.editMessageText>[4] = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
        ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      };
      if (messageId) {
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
        }
      }
      const sendOptions: Parameters<typeof this.bot.telegram.sendMessage>[2] = {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
        ...(typeof topicId === 'number' ? { message_thread_id: topicId } : {}),
      };
      const sent = await this.bot.telegram.sendMessage(chatId, text, sendOptions);
      if (sent?.message_id) {
        await updateTaskHistoryMessageId(taskId, sent.message_id);
      }
    } catch (error) {
      console.error('Не удалось обновить историю статусов задачи', error);
    }
  }
}
