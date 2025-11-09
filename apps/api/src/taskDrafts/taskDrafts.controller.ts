// Контроллер черновиков задач
// Основные модули: express, taskDrafts.service, utils/problem
import { injectable, inject } from 'tsyringe';
import type { Response } from 'express';
import { TOKENS } from '../di/tokens';
import TaskDraftsService from './taskDrafts.service';
import { sendProblem } from '../utils/problem';
import type { RequestWithUser } from '../types/request';

const normalizeKind = (value: unknown): 'task' | 'request' | null => {
  if (value === 'task' || value === 'request') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'task' || trimmed === 'request') {
      return trimmed;
    }
  }
  return null;
};

const mapDraft = (draft: {
  _id: unknown;
  userId: number;
  kind: 'task' | 'request';
  payload: Record<string, unknown>;
  attachments?: unknown;
  updatedAt?: Date;
  createdAt?: Date;
}) => ({
  id: String(draft._id),
  userId: draft.userId,
  kind: draft.kind,
  payload: draft.payload,
  attachments: draft.attachments ?? [],
  updatedAt: draft.updatedAt ?? null,
  createdAt: draft.createdAt ?? null,
});

@injectable()
export default class TaskDraftsController {
  constructor(
    @inject(TOKENS.TaskDraftsService)
    private readonly service: TaskDraftsService,
  ) {}

  get = async (req: RequestWithUser, res: Response) => {
    const kind = normalizeKind(req.params.kind);
    if (!kind) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Некорректный тип черновика',
        status: 400,
        detail: 'Unknown draft kind',
      });
      return;
    }
    const userId = Number(req.user?.id);
    const draft = Number.isFinite(userId)
      ? await this.service.getDraft(userId, kind)
      : null;
    if (!draft) {
      res.status(404).json({ error: 'Черновик не найден' });
      return;
    }
    res.json(mapDraft({ ...draft, userId }));
  };

  save = async (req: RequestWithUser, res: Response) => {
    const kind = normalizeKind(req.params.kind);
    if (!kind) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Некорректный тип черновика',
        status: 400,
        detail: 'Unknown draft kind',
      });
      return;
    }
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка авторизации',
        status: 401,
        detail: 'User id is missing',
      });
      return;
    }
    const payload = (req.body as { payload?: unknown }).payload;
    const draft = await this.service.saveDraft(userId, kind, payload);
    res.status(200).json(mapDraft({ ...draft.toObject(), userId }));
  };

  remove = async (req: RequestWithUser, res: Response) => {
    const kind = normalizeKind(req.params.kind);
    if (!kind) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Некорректный тип черновика',
        status: 400,
        detail: 'Unknown draft kind',
      });
      return;
    }
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Ошибка авторизации',
        status: 401,
        detail: 'User id is missing',
      });
      return;
    }
    await this.service.deleteDraft(userId, kind);
    res.sendStatus(204);
  };
}
