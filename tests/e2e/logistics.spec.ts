/**
 * Назначение файла: e2e-тесты живых обновлений логистики и задач.
 * Основные модули: express, @playwright/test, services/logisticsEvents.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { RoutePlan } from 'shared';
import {
  createHeartbeatEvent,
  createInitEvent,
  notifyRoutePlanRemoved,
  notifyRoutePlanUpdated,
  notifyTasksChanged,
  subscribeLogisticsEvents,
} from '../../apps/api/src/services/logisticsEvents';

const app = express();
app.use(express.json());

const PORT = 4310;
const baseUrl = `http://127.0.0.1:${PORT}`;

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write('retry: 5000\n\n');
  res.write(`data: ${JSON.stringify(createInitEvent())}\n\n`);

  const unsubscribe = subscribeLogisticsEvents((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify(createHeartbeatEvent())}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.get('/client', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset="utf-8" /><script>
    window.events = [];
    window.autoRecalcCount = 0;
    window.latestPlanTitle = '';
    const job = { refreshTasks: false, refreshPlan: false, recalc: false };
    let timer = null;
    function schedule(opts) {
      job.refreshTasks = job.refreshTasks || !!opts.refreshTasks;
      job.refreshPlan = job.refreshPlan || !!opts.refreshPlan;
      job.recalc = job.recalc || !!opts.recalc;
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        if (job.refreshTasks || job.refreshPlan || job.recalc) {
          window.autoRecalcCount += 1;
        }
        job.refreshTasks = false;
        job.refreshPlan = false;
        job.recalc = false;
      }, 600);
    }
    const source = new EventSource('/events');
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        window.events.push(data);
        if (data.type === 'tasks.changed') {
          schedule({ refreshTasks: true, refreshPlan: true, recalc: true });
        } else if (data.type === 'route-plan.updated' && data.plan) {
          window.latestPlanTitle = data.plan.title || '';
        }
      } catch (error) {
        console.error('parse error', error);
      }
    };
  </script>`);
});

let taskCounter = 1;
const activeTasks: string[] = [];

app.post('/tasks', (req, res) => {
  const id = `task-${taskCounter++}`;
  activeTasks.push(id);
  notifyTasksChanged('created', [id]);
  res.status(201).json({ id });
});

app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const idx = activeTasks.indexOf(id);
  if (idx === -1) {
    return res.sendStatus(404);
  }
  activeTasks.splice(idx, 1);
  notifyTasksChanged('deleted', [id]);
  res.sendStatus(204);
});

app.post('/plan', (req, res) => {
  const plan = req.body as RoutePlan;
  notifyRoutePlanUpdated(plan, 'updated');
  res.status(200).json(plan);
});

app.delete('/plan/:id', (req, res) => {
  notifyRoutePlanRemoved(req.params.id);
  res.sendStatus(204);
});

let server: Server;

test.beforeAll(() => {
  server = app.listen(PORT);
});

test.afterAll(() => {
  server.close();
});

test.describe('Логистика: потоковые события', () => {
  test('стрим сообщает об изменениях задач и маршрутов', async ({
    page,
    request,
  }) => {
    await page.goto(`${baseUrl}/client`);

    await page.waitForFunction(
      () =>
        Array.isArray(window.events) &&
        window.events.some((event) => event.type === 'logistics.init'),
    );

    const createResponse = await request.post(`${baseUrl}/tasks`, {
      data: { title: 'Новая' },
    });
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    await page.waitForFunction(
      (taskId) =>
        window.events.some(
          (event) =>
            event.type === 'tasks.changed' &&
            event.action === 'created' &&
            event.taskIds.includes(taskId),
        ),
      created.id,
    );

    const deleteResponse = await request.delete(
      `${baseUrl}/tasks/${created.id}`,
    );
    expect(deleteResponse.status()).toBe(204);

    await page.waitForFunction(
      (taskId) =>
        window.events.some(
          (event) =>
            event.type === 'tasks.changed' &&
            event.action === 'deleted' &&
            event.taskIds.includes(taskId),
        ),
      created.id,
    );

    await page.evaluate(() => {
      window.autoRecalcCount = 0;
    });

    const first = await request.post(`${baseUrl}/tasks`, {
      data: { title: 'Первая' },
    });
    expect(first.status()).toBe(201);
    const second = await request.post(`${baseUrl}/tasks`, {
      data: { title: 'Вторая' },
    });
    expect(second.status()).toBe(201);

    await page.waitForTimeout(1200);
    const autoCount = await page.evaluate(() => window.autoRecalcCount);
    expect(autoCount).toBe(1);

    const plan: RoutePlan = {
      id: 'plan-1',
      title: 'Тестовый план',
      status: 'draft',
      metrics: {
        totalDistanceKm: 0,
        totalRoutes: 0,
        totalTasks: 0,
        totalStops: 0,
        totalEtaMinutes: null,
        totalLoad: null,
      },
      routes: [],
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const planResponse = await request.post(`${baseUrl}/plan`, { data: plan });
    expect(planResponse.status()).toBe(200);

    await page.waitForFunction(
      (title) => window.latestPlanTitle === title,
      plan.title,
    );

    const removeResponse = await request.delete(`${baseUrl}/plan/${plan.id}`);
    expect(removeResponse.status()).toBe(204);

    await page.waitForFunction(
      (planId) =>
        window.events.some(
          (event) =>
            event.type === 'route-plan.removed' && event.planId === planId,
        ),
      plan.id,
    );
  });
});
