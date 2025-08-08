// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, container
import { handleValidation } from '../utils/validate';
import container from '../container';
import type { Request, Response } from 'express';
import RolesService from './roles.service';
import { sendProblem } from '../utils/problem';
const service = container.resolve<RolesService>('RolesService');

export const list = async (_req: Request, res: Response) => {
  res.json(await service.list());
};

export const update = [
  handleValidation,
  async (req: Request, res: Response) => {
    const role = await service.update(req.params.id, req.body.permissions);
    if (!role) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Роль не найдена',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    res.json(role);
  },
];
