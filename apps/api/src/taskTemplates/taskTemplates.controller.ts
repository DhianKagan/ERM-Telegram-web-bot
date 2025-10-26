// Контроллер шаблонов задач
// Основные модули: express, services
import type { Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import type TaskTemplatesService from './taskTemplates.service';
import { handleValidation } from '../utils/validate';
import { sendProblem } from '../utils/problem';
import type { TaskTemplateDocument } from '../db/model';
import type RequestWithUser from '../types/request';

const resolveUserId = (req: RequestWithUser): number | null => {
  const rawId = req.user?.id;
  const numeric = Number(rawId);
  return Number.isFinite(numeric) ? numeric : null;
};

@injectable()
export default class TaskTemplatesController {
  constructor(
    @inject(TOKENS.TaskTemplatesService) private service: TaskTemplatesService,
  ) {}

  list = async (req: RequestWithUser, res: Response) => {
    const userId = resolveUserId(req);
    if (userId === null) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка авторизации',
        status: 401,
        detail: 'User id is missing',
      });
      return;
    }
    const templates = await this.service.list(userId);
    res.json(templates);
  };

  detail = async (req: RequestWithUser, res: Response) => {
    const userId = resolveUserId(req);
    if (userId === null) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка авторизации',
        status: 401,
        detail: 'User id is missing',
      });
      return;
    }
    const tpl = await this.service.getById(req.params.id, userId);
    if (!tpl) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Шаблон не найден',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    res.json(tpl);
  };

  create = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const userId = resolveUserId(req);
      if (userId === null) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 401,
          detail: 'User id is missing',
        });
        return;
      }
      const payload = req.body as Partial<TaskTemplateDocument>;
      const name =
        typeof payload.name === 'string' ? payload.name.trim() : undefined;
      if (!name) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка валидации',
          status: 400,
          detail: 'Название шаблона не указано',
        });
        return;
      }
      const data =
        payload.data &&
        typeof payload.data === 'object' &&
        !Array.isArray(payload.data)
          ? (payload.data as Record<string, unknown>)
          : {};
      const tpl = await this.service.create({
        name,
        data,
        userId,
      });
      res.status(201).json(tpl);
    },
  ];

  remove = [
    handleValidation,
    async (req: RequestWithUser, res: Response) => {
      const userId = resolveUserId(req);
      if (userId === null) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Ошибка авторизации',
          status: 401,
          detail: 'User id is missing',
        });
        return;
      }
      const removed = await this.service.remove(req.params.id, userId);
      if (!removed) {
        sendProblem(req, res, {
          type: 'about:blank',
          title: 'Шаблон не найден',
          status: 404,
          detail: 'Not Found',
        });
        return;
      }
      res.sendStatus(204);
    },
  ];
}
