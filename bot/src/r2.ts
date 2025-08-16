// Маршруты подписи R2
// Модули: express, middleware/auth, db/queries
import { Router, Response } from 'express';
import authMiddleware from './middleware/auth';
import { createUpload, getUpload } from './db/queries';
import type RequestWithUser from './types/request';

const router = Router();
const keyRegex = /^[\w./-]+$/;
const maxSize = Number(process.env.R2_MAX_SIZE || 20 * 1024 * 1024);

router.post(
  '/sign-upload',
  authMiddleware(),
  async (req: RequestWithUser, res: Response) => {
    const key = String(req.query.key || '');
    if (!keyRegex.test(key)) {
      res.status(400).json({ error: 'Неверный ключ' });
      return;
    }
    const mime = req.get('Content-Type');
    if (!mime) {
      res.status(415).json({ error: 'Не указан Content-Type' });
      return;
    }
    const lenHeader = req.get('Content-Length');
    const size = lenHeader ? Number(lenHeader) : NaN;
    if (!Number.isFinite(size)) {
      res.status(411).json({ error: 'Не указан Content-Length' });
      return;
    }
    if (size > maxSize) {
      res.status(413).json({ error: 'Размер превышает допустимый' });
      return;
    }
    await createUpload({
      key,
      mime,
      size,
      owner: Number(req.user?.id || 0),
    });
    res.json({ ok: true });
  },
);

router.get(
  '/sign-get',
  authMiddleware(),
  async (req: RequestWithUser, res: Response) => {
    const key = String(req.query.key || '');
    if (!keyRegex.test(key)) {
      res.status(400).json({ error: 'Неверный ключ' });
      return;
    }
    const file = await getUpload(key);
    if (!file) {
      res.status(404).json({ error: 'Файл не найден' });
      return;
    }
    if (file.owner !== Number(req.user?.id)) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return;
    }
    res.json({ ok: true, mime: file.mime, size: file.size });
  },
);

export default router;
