// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, container
import { handleValidation } from '../utils/validate';
import container from '../container';
import type { Request, Response } from 'express';
import RolesService from './roles.service';
const service = container.resolve<RolesService>('RolesService');

export const list = async (_req: Request, res: Response) => {
  res.json(await service.list());
};

export const update = [
  handleValidation,
  async (req: Request, res: Response) => {
    const role = await service.update(req.params.id, req.body.permissions);
    if (!role) return res.sendStatus(404);
    res.json(role);
  },
];
