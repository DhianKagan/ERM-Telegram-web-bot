// Контроллер пользователей с использованием UsersService
// Основные модули: express-validator, utils/formatUser, express
import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { handleValidation } from '../utils/validate';
import { TOKENS } from '../di/tokens';
import type UsersService from './users.service';
import type { UserDocument } from '../db/model';
import formatUser from '../utils/formatUser';
import { sendCached } from '../utils/sendCached';
import { sendProblem } from '../utils/problem';

interface CreateUserBody {
  id?: string | number;
  username?: string;
  roleId?: string;
}

type UpdateUserBody = Omit<Partial<UserDocument>, 'access' | 'role'>;

@injectable()
export default class UsersController {
  constructor(@inject(TOKENS.UsersService) private service: UsersService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const users = await this.service.list();
    sendCached(
      req,
      res,
      users.map((u) => formatUser(u)),
    );
  };

  get = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const user = await this.service.get(req.params.id);
    if (!user) {
      sendProblem(req, res, {
        type: 'about:blank',
        title: 'Пользователь не найден',
        status: 404,
        detail: 'Not Found',
      });
      return;
    }
    res.json(formatUser(user));
  };

  create = [
    handleValidation,
    async (
      req: Request<unknown, unknown, CreateUserBody>,
      res: Response,
    ): Promise<void> => {
      const rawId = req.body.id;
      const rawUsername = req.body.username;
      const normalizedId =
        typeof rawId === 'string'
          ? rawId.trim() || undefined
          : rawId !== undefined
          ? rawId
          : undefined;
      const normalizedUsername =
        typeof rawUsername === 'string'
          ? rawUsername.trim() || undefined
          : rawUsername !== undefined
          ? String(rawUsername)
          : undefined;
      const normalizedRoleId =
        typeof req.body.roleId === 'string'
          ? req.body.roleId.trim() || undefined
          : req.body.roleId;

      if (req.query.preview === 'true' || req.query.preview === '1') {
        const generated = await this.service.generate(
          normalizedId,
          normalizedUsername,
        );
        res.json({
          telegram_id: generated.telegramId,
          username: generated.username,
        });
        return;
      }

      const user = await this.service.create(
        normalizedId,
        normalizedUsername,
        normalizedRoleId,
      );
      res.status(201).json(formatUser(user));
    },
  ];

  update = [
    handleValidation,
    async (
      req: Request<{ id: string }, unknown, UpdateUserBody>,
      res: Response,
    ): Promise<void> => {
      const user = await this.service.update(req.params.id, req.body);
      res.json(formatUser(user));
    },
  ];
}
