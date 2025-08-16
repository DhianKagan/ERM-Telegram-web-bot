// Роут подписи загрузки в R2
// Модули: express, middleware/auth
import { Router, Request, Response } from 'express';
import authMiddleware from './middleware/auth';

const router = Router();
const keyRegex = /^[\w./-]+$/;
const maxSize = Number(process.env.R2_MAX_SIZE || 20 * 1024 * 1024);

router.post('/sign-upload', authMiddleware(), (req: Request, res: Response) => {
  const key = String(req.query.key || '');
  if (!keyRegex.test(key)) {
    res.status(400).json({ error: 'Неверный ключ' });
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
  res.json({ ok: true });
});

export default router;
