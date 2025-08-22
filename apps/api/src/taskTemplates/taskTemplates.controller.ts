// Контроллер шаблонов задач
// Основные модули: express, services
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import type TaskTemplatesService from './taskTemplates.service';
import { handleValidation } from '../utils/validate';
import { sendProblem } from '../utils/problem';
import type { TaskTemplateDocument } from '../db/model';

@injectable()
export default class TaskTemplatesController {
  constructor(
    @inject(TOKENS.TaskTemplatesService) private service: TaskTemplatesService,
  ) {}

  list = async (_req: Request, res: Response) => {
    const templates = await this.service.list();
    res.json(templates);
  };

  detail = async (req: Request, res: Response) => {
    const tpl = await this.service.getById(req.params.id);
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
    async (req: Request, res: Response) => {
      const tpl = await this.service.create(
        req.body as Partial<TaskTemplateDocument>,
      );
      res.status(201).json(tpl);
    },
  ];
}
