// Контроллер пользователей с использованием UsersService
// Основные модули: express-validator, container, utils/formatUser
// @ts-nocheck
import { handleValidation } from '../utils/validate.js';
import container from '../container';
const service = /** @type {any} */ (container.resolve('UsersService'));
import formatUser from '../utils/formatUser.js';

export const list = async (_req, res) => {
  const users = await service.list();
  res.json(users.map((u) => formatUser(u)));
};

export const create = [
  handleValidation,
  async (req, res) => {
    const user = await service.create(
      req.body.id,
      req.body.username,
      req.body.roleId,
    );
    res.status(201).json(formatUser(user));
  },
];
