/**
 * Назначение файла: e2e-проверка скачивания отчётов задач в PDF и XLSX.
 * Основные модули: @playwright/test, express, exceljs.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import TasksService from '../../apps/api/src/tasks/tasks.service';
import ReportGeneratorService from '../../apps/api/src/services/reportGenerator';
import type { TaskDocument, UserDocument } from '../../apps/api/src/db/model';

const sampleTasks: TaskDocument[] = [
  {
    _id: 'task-1',
    task_number: 'ERM_000001',
    title: 'Доставка оборудования',
    status: 'new',
    assignees: [101],
    createdAt: new Date('2024-01-10T10:00:00Z'),
    history: [],
  } as unknown as TaskDocument,
  {
    _id: 'task-2',
    task_number: 'ERM_000002',
    title: 'Монтаж стенда',
    status: 'in_progress',
    assignees: [202],
    createdAt: new Date('2024-01-11T12:30:00Z'),
    history: [],
  } as unknown as TaskDocument,
];

const repo = {
  async getTasks() {
    return { tasks: sampleTasks, total: sampleTasks.length };
  },
  async getTask() {
    return null;
  },
  async updateTask() {
    return null;
  },
  async addTime() {
    return null;
  },
  async bulkUpdate() {
    return undefined;
  },
  async summary() {
    return { count: sampleTasks.length, time: 0 };
  },
  async chart() {
    return { labels: [], values: [] } as unknown;
  },
  async deleteTask() {
    return null;
  },
  async listMentionedTasks() {
    return sampleTasks;
  },
} as const;

const tasksService = new TasksService(
  repo as unknown as ConstructorParameters<typeof TasksService>[0],
);

const usersMap: Record<number, UserDocument> = {
  101: { telegram_id: 101, name: 'Иван', access: 1 } as unknown as UserDocument,
  202: { telegram_id: 202, name: 'Мария', access: 1 } as unknown as UserDocument,
};

const reportGenerator = new ReportGeneratorService(
  tasksService,
  async (ids) => {
    const result: Record<number, UserDocument> = {};
    ids.forEach((id) => {
      const numeric = Number(id);
      if (Number.isFinite(numeric) && usersMap[numeric]) {
        result[numeric] = usersMap[numeric];
      }
    });
    return result;
  },
);

const app = express();
app.get('/api/v1/tasks/report.pdf', (req, res) => {
  reportGenerator
    .generatePdf(req.query as Record<string, unknown>, {
      id: 1,
      role: 'admin',
      access: 2,
    })
    .then((result) => {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      res.send(result.data);
    })
    .catch((error) => {
      console.error('pdf report error', error);
      res.sendStatus(500);
    });
});
app.get('/api/v1/tasks/report.xlsx', (req, res) => {
  reportGenerator
    .generateExcel(req.query as Record<string, unknown>, {
      id: 1,
      role: 'admin',
      access: 2,
    })
    .then((result) => {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      );
      res.send(result.data);
    })
    .catch((error) => {
      console.error('xlsx report error', error);
      res.sendStatus(500);
    });
});

let server: Server;
let baseURL: string;

test.beforeAll(() => {
  server = app.listen(0);
  baseURL = (() => {
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  })();
});

test.afterAll(() => {
  server.close();
});

test('скачивание PDF отчёта возвращает корректный заголовок', async ({ request }) => {
  const res = await request.get(`${baseURL}/api/v1/tasks/report.pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  const disposition = res.headers()['content-disposition'] ?? '';
  expect(disposition).toContain('.pdf');
  const body = await res.body();
  expect(body.byteLength).toBeGreaterThan(500);
  expect(body.slice(0, 4).toString()).toBe('%PDF');
});

test('скачивание XLSX отчёта возвращает zip-архив', async ({ request }) => {
  const res = await request.get(
    `${baseURL}/api/v1/tasks/report.xlsx?from=2024-01-01&status=new`,
  );
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const disposition = res.headers()['content-disposition'] ?? '';
  expect(disposition).toContain('.xlsx');
  const body = await res.body();
  expect(body.byteLength).toBeGreaterThan(400);
  expect(body.toString('utf8', 0, 2)).toBe('PK');
});
