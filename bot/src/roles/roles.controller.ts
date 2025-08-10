// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, express
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type RolesService from './roles.service';
import { sendProblem } from '../utils/problem';

@injectable()
export default class RolesController {
  constructor(@inject(TOKENS.RolesService) private service: RolesService) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.service.list());
  };

  update = [
    handleValidation,
    async (req: Request, res: Response) => {
      const role = await this.service.update(
        req.params.id,
        req.body.permissions,
      );
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
}
