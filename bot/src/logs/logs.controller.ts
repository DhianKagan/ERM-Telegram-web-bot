// Контроллер логов с использованием LogsService
// Основные модули: express-validator, container
// @ts-nocheck
import { handleValidation } from '../utils/validate.js';
import container from '../container';
const service = /** @type {any} */ (container.resolve('LogsService'));

export const list = async (req, res) => {
  res.json(await service.list(req.query));
};

export const create = [
  handleValidation,
  async (req, res) => {
    if (typeof req.body.message === 'string') {
      await service.write(req.body.message);
    }
    res.json({ status: 'ok' });
  },
];
