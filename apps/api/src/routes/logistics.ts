// Маршруты SSE для логистических событий.
// Основные модули: express, services/logisticsEvents, middleware/auth.

import { Router, type Response } from 'express';
import authMiddleware from '../middleware/auth';
import { asyncHandler } from '../api/middleware';
import {
  createHeartbeatEvent,
  createInitEvent,
  subscribeLogisticsEvents,
} from '../services/logisticsEvents';

const router: Router = Router();

function writeEvent(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.get(
  '/events',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write('retry: 5000\n\n');

    writeEvent(res, createInitEvent());

    const unsubscribe = subscribeLogisticsEvents((event) => {
      try {
        writeEvent(res, event);
      } catch (error) {
        console.error('Не удалось отправить событие логистики', error);
      }
    });

    const heartbeat = setInterval(() => {
      try {
        writeEvent(res, createHeartbeatEvent());
      } catch (error) {
        console.error('Не удалось отправить heartbeat логистики', error);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }),
);

export default router;
