// Контроллер пользователей с использованием UsersService
// Основные модули: express-validator, container, utils/formatUser, express
import { Request, Response } from 'express';
import { handleValidation } from '../utils/validate';
import container from '../container';
import UsersService from './users.service';
import formatUser from '../utils/formatUser';

interface CreateUserBody {
  id: string;
  username?: string;
  roleId?: string;
}

const service = container.resolve<UsersService>('UsersService');

export const list = async (_req: Request, res: Response): Promise<void> => {
  const users = await service.list();
  res.json(users.map((u) => formatUser(u)));
};

export const create = [
  handleValidation,
  async (
    req: Request<unknown, unknown, CreateUserBody>,
    res: Response,
  ): Promise<void> => {
    const user = await service.create(
      req.body.id,
      req.body.username,
      req.body.roleId,
    );
    res.status(201).json(formatUser(user));
  },
];
