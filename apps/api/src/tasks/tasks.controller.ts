// Контроллер задач с использованием TasksService
// Основные модули: express-validator, services, wgLogEngine
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type TasksService from './tasks.service';
import { writeLog } from '../services/service';
import { getUsersMap } from '../db/queries';
import type { RequestWithUser } from '../types/request';
import { Task, type TaskDocument } from '../db/model';
import { sendProblem } from '../utils/problem';
import { sendCached } from '../utils/sendCached';
import {
  PROJECT_TIMEZONE,
  PROJECT_TIMEZONE_LABEL,
  type Task as SharedTask,
} from 'shared';
import { bot } from '../bot/bot';
import { chatId as groupChatId } from '../config';
import taskStatusKeyboard from '../utils/taskButtons';
import formatTask from '../utils/formatTask';
import buildChatMessageLink from '../utils/messageLink';

type TaskEx = SharedTask & {
  controllers?: number[];
  created_by?: number;
  history?: { changed_by: number }[];
};

const taskEventFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

@injectable()
export default class TasksController {
  constructor(@inject(TOKENS.TasksService) private service: TasksService) {}

  private collectNotificationTargets(task: Partial<TaskDocument>, creatorId?: number) {
    const recipients = new Set<number>();
    const add = (value: unknown) => {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0)
        recipients.add(num);
    };
    add(task.assigned_user_id);
    if (Array.isArray(task.assignees)) task.assignees.forEach(add);
    add(task.controller_user_id);
    if (Array.isArray(task.controllers)) task.controllers.forEach(add);
    add(task.created_by);
    if (creatorId !== undefined) add(creatorId);
    return recipients;
  }

  private collectAssignees(task: Partial<TaskDocument>) {
    const recipients = new Set<number>();
    const add = (value: unknown) => {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num) && num !== 0) {
        recipients.add(num);
      }
    };
    add(task.assigned_user_id);
    if (Array.isArray(task.assignees)) task.assignees.forEach(add);
    return recipients;
  }

  private getTaskIdentifier(task: Partial<TaskDocument>) {
    if (task.request_id) return String(task.request_id);
    if (task.task_number) return String(task.task_number);
    if (task._id) {
      if (typeof task._id === 'object' && 'toString' in task._id) {
        return (task._id as { toString(): string }).toString();
      }
      return String(task._id);
    }
    return '';
  }

  private buildActionMessage(
    task: Partial<TaskDocument>,
    action: string,
    at: Date,
  ): string {
    const identifier = this.getTaskIdentifier(task);
    const formatted = taskEventFormatter.format(at).replace(', ', ' ');
    return `Задача ${identifier} ${action} ${formatted} (${PROJECT_TIMEZONE_LABEL})`;
  }

  private async notifyTaskCreated(task: TaskDocument, creatorId: number) {
    const docId =
      typeof task._id === 'object' && task._id !== null && 'toString' in task._id
        ? (task._id as { toString(): string }).toString()
        : String(task._id ?? '');
    const plain =
      typeof task.toObject === 'function'
        ? (task.toObject() as TaskDocument & Record<string, unknown>)
        : task;
    if (!docId) return;
    const recipients = this.collectNotificationTargets(plain, creatorId);
    const usersRaw = await getUsersMap(Array.from(recipients));
    const users = Object.fromEntries(
      Object.entries(usersRaw).map(([key, value]) => {
        const name = value.name ?? value.username ?? '';
        const username = value.username ?? '';
        return [Number(key), { name, username }];
      }),
    );
    const mainKeyboard = taskStatusKeyboard(docId);
    const message = formatTask(plain as unknown as SharedTask, users);
    let groupMessageId: number | undefined;
    let statusMessageId: number | undefined;
    let messageLink: string | null = null;

    if (groupChatId) {
      try {
        const groupOptions: Parameters<typeof bot.telegram.sendMessage>[2] = {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard,
        };
        if (typeof plain.telegram_topic_id === 'number') {
          groupOptions.message_thread_id = plain.telegram_topic_id;
        }
        const groupMessage = await bot.telegram.sendMessage(
          groupChatId,
          message,
          groupOptions,
        );
        groupMessageId = groupMessage?.message_id;
        messageLink = buildChatMessageLink(groupChatId, groupMessageId);
        const statusText = this.buildActionMessage(
          plain,
          'создана',
          new Date(
            (plain as { createdAt?: string | Date }).createdAt ?? Date.now(),
          ),
        );
        const statusOptions: Parameters<typeof bot.telegram.sendMessage>[2] = {};
        if (typeof plain.telegram_topic_id === 'number') {
          statusOptions.message_thread_id = plain.telegram_topic_id;
        }
        if (groupMessageId) {
          statusOptions.reply_parameters = { message_id: groupMessageId };
        }
        const statusMessage = await bot.telegram.sendMessage(
          groupChatId,
          statusText,
          statusOptions,
        );
        statusMessageId = statusMessage?.message_id;
      } catch (error) {
        console.error('Не удалось отправить уведомление в группу', error);
      }
    }

    const assignees = this.collectAssignees(plain);
    assignees.delete(creatorId);
    if (messageLink && assignees.size) {
      const identifier = this.getTaskIdentifier(plain);
      const dmText = `Вам назначена задача <a href="${messageLink}">${identifier}</a>`;
      const dmOptions: Parameters<typeof bot.telegram.sendMessage>[2] = {
        ...taskStatusKeyboard(docId),
        parse_mode: 'HTML',
      };
      await Promise.allSettled(
        Array.from(assignees).map((userId) =>
          bot.telegram
            .sendMessage(userId, dmText, dmOptions)
            .catch((error) => {
              console.error(
                `Не удалось отправить уведомление пользователю ${userId}`,
                error,
              );
            }),
        ),
      );
    }

    if (groupMessageId || statusMessageId) {
      try {
        await Task.findByIdAndUpdate(docId, {
          telegram_message_id: groupMessageId,
          telegram_status_message_id: statusMessageId,
        }).exec();
      } catch (error) {
        console.error('Не удалось сохранить идентификаторы сообщений задачи', error);
      }
    }
  }

  list = async (req: RequestWithUser, res: Response) => {
    const { page, limit, ...filters } = req.query;
    let tasks: TaskEx[];
    let total = 0;
    if (['admin', 'manager'].includes(req.user!.role || '')) {
      const res = await this.service.get(
        filters,
        page ? Number(page) : undefined,
        limit ? Number(limit) : undefined,
      );
      tasks = res.tasks as unknown as TaskEx[];
      total = res.total;
    } else {
      tasks = (await this.service.mentioned(
        String(req.user!.id),
      )) as unknown as TaskEx[];
      total = tasks.length;
    }
    const ids = new Set<number>();
    tasks.forEach((t) => {
      (t.assignees || []).forEach((id: number) => ids.add(id));
      (t.controllers || []).forEach((id: number) => ids.add(id));
      if (t.created_by) ids.add(t.created_by);
      (t.history || []).forEach((h) => ids.add(h.changed_by));
    });
    const users = await getUsersMap(Array.from(ids));
    sendCached(req, res, { tasks, users, total });
  };

  detail = async (req: Request, res: Response) => {
    const task = (await this.service.getById(
      req.params.id,
    )) as unknown as TaskEx | null;
    if (!task) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Задача не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    const ids = new Set<number>();
    (task.assignees || []).forEach((id: number) => ids.add(id));
    (task.controllers || []).forEach((id: number) => ids.add(id));
    if (task.created_by) ids.add(task.created_by);
    (task.history || []).forEach((h) => ids.add(h.changed_by));
    const users = await getUsersMap(Array.from(ids));
    res.json({ task, users });
  };

  create = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const task = await this.service.create(
        req.body as Partial<TaskDocument>,
        req.user!.id as number,
      );
      await writeLog(
        `Создана задача ${task._id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.status(201).json(task);
      void this.notifyTaskCreated(task, req.user!.id as number).catch((error) => {
        console.error('Не удалось отправить уведомление о создании задачи', error);
      });
    },
  ];

  update = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const task = await this.service.update(
        req.params.id,
        req.body as Partial<TaskDocument>,
        req.user!.id as number,
      );
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      await writeLog(
        `Обновлена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
    },
  ];

  addTime = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const { minutes } = req.body as { minutes: number };
      const task = await this.service.addTime(req.params.id, minutes);
      if (!task) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Задача не найдена',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      await writeLog(
        `Время по задаче ${req.params.id} +${minutes} пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json(task);
    },
  ];

  bulk = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const { ids, status } = req.body as {
        ids: string[];
        status: TaskDocument['status'];
      };
      await this.service.bulk(ids, { status });
      await writeLog(
        `Массовое изменение статусов пользователем ${req.user!.id}/${req.user!.username}`,
      );
      res.json({ status: 'ok' });
    },
  ];

  mentioned = async (req: RequestWithUser, res: Response) => {
    const tasks = await this.service.mentioned(String(req.user!.id));
    res.json(tasks);
  };

  summary = async (req: Request, res: Response) => {
    res.json(await this.service.summary(req.query));
  };

  remove = async (req: RequestWithUser, res: Response) => {
    const task = await this.service.remove(req.params.id);
    if (!task) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Задача не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    await writeLog(
      `Удалена задача ${req.params.id} пользователем ${req.user!.id}/${req.user!.username}`,
    );
    res.sendStatus(204);
  };
}
