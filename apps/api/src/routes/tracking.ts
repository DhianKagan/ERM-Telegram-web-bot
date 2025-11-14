// Роутер SSE для событий живого трекинга транспорта
// Основные модули: express, middleware/auth, services/liveTracking, shared
import type { Request, Response, Router as ExpressRouter } from 'express';
import { Router as createRouter } from 'express';
import type { TrackingEvent } from 'shared';
import authMiddleware from '../middleware/auth';
import { subscribeTrackingEvents } from '../services/liveTracking';

const router: ExpressRouter = createRouter();

const HEARTBEAT_INTERVAL_MS = 25_000;

function writeEvent(res: Response, event: TrackingEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

router.get('/stream', authMiddleware(), (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (
    typeof (res as Response & { flushHeaders?: () => void }).flushHeaders ===
    'function'
  ) {
    (res as Response & { flushHeaders?: () => void }).flushHeaders();
  }

  const initEvent: TrackingEvent = {
    type: 'init',
    timestamp: new Date().toISOString(),
    alarms: [],
  };
  writeEvent(res, initEvent);

  const unsubscribe = subscribeTrackingEvents((event) => {
    try {
      writeEvent(res, event);
    } catch (error) {
      console.error('Не удалось отправить событие трекинга', error);
    }
  });

  const heartbeatTimer = setInterval(() => {
    const heartbeat: TrackingEvent = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    };
    try {
      writeEvent(res, heartbeat);
    } catch (error) {
      console.error('Не удалось отправить heartbeat трекинга', error);
    }
  }, HEARTBEAT_INTERVAL_MS);

  const close = () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
    res.end();
  };

  req.on('close', close);
  req.on('error', close);
});

export default router;
