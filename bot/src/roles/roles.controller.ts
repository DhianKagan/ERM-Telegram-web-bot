// Контроллер ролей с использованием RolesService
// Основные модули: express-validator, container
import { handleValidation } from '../utils/validate.js';
import container from '../container';
const service = container.resolve('RolesService');

export const list = async (_req, res) => {
  res.json(await service.list());
};

export const update = [
  handleValidation,
  async (req, res) => {
    const role = await service.update(req.params.id, req.body.permissions);
    if (!role) return res.sendStatus(404);
    res.json(role);
  },
];
