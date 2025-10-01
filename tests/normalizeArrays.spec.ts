// Назначение файла: проверка нормализации массивов и вложений в middleware normalizeArrays.
// Основные модули: express RequestHandler, json5-парсинг, jest.
import type { Request, Response, NextFunction } from 'express';
import { normalizeArrays } from '../apps/api/src/routes/tasks';

describe('normalizeArrays', () => {
  const createReq = (body: Record<string, unknown>): Request =>
    ({ body } as unknown as Request);
  const res = {} as Response;

  it('парсит вложения из строки в формате JSON5', () => {
    const req = createReq({
      attachments:
        "[{ name: 'аккаунты.xlsx', url: '/api/v1/files/1', uploadedBy: 7263608097, uploadedAt: '2025-09-22T22:03:57.025Z', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 10802 }]",
    });
    const next = jest.fn() as unknown as NextFunction;
    normalizeArrays(req, res, next);
    expect(Array.isArray((req.body as Record<string, unknown>).attachments)).toBe(
      true,
    );
    const attachments = (req.body as { attachments: unknown[] }).attachments;
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      name: 'аккаунты.xlsx',
      url: '/api/v1/files/1',
      uploadedBy: 7263608097,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 10802,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('очищает вложения при невалидной строке', () => {
    const req = createReq({ attachments: '[{ name: аккаунты.xlsx }' });
    const next = jest.fn() as unknown as NextFunction;
    normalizeArrays(req, res, next);
    const attachments = (req.body as { attachments?: unknown[] }).attachments;
    expect(Array.isArray(attachments)).toBe(true);
    expect(attachments).toHaveLength(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('фильтрует посторонние значения в массиве вложений', () => {
    const req = createReq({ attachments: ['строка', 5, { name: 'файл', url: '/api/v1/files/2', type: 'image/png', size: 2048 }] });
    const next = jest.fn() as unknown as NextFunction;
    normalizeArrays(req, res, next);
    const attachments = (req.body as { attachments?: unknown[] }).attachments;
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0]).toMatchObject({ name: 'файл', url: '/api/v1/files/2' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('нормализует assigned_user_id и приводит его к массиву assignees', () => {
    const req = createReq({ assigned_user_id: ' 42 ' });
    const next = jest.fn() as unknown as NextFunction;
    normalizeArrays(req, res, next);
    expect((req.body as { assigned_user_id: unknown }).assigned_user_id).toBe('42');
    expect((req.body as { assignees: unknown[] }).assignees).toEqual(['42']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('очищает назначение при пустом assigned_user_id', () => {
    const req = createReq({ assigned_user_id: '' });
    const next = jest.fn() as unknown as NextFunction;
    normalizeArrays(req, res, next);
    expect((req.body as { assigned_user_id: unknown }).assigned_user_id).toBeNull();
    expect((req.body as { assignees: unknown[] }).assignees).toEqual([]);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
