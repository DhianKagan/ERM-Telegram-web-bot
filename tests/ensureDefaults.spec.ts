// Назначение: проверка идемпотентности ensureDefaults
// Основные модули: mongoose, ensureDefaults
jest.mock('mongoose', () => {
  const updateOne = jest.fn().mockResolvedValue({ upsertedCount: 1 });
  const model = jest.fn(() => ({ updateOne }));
  const connection = {
    db: { admin: () => ({ ping: jest.fn().mockResolvedValue(undefined) }) },
  };
  return {
    Schema: class {},
    model,
    connect: jest.fn().mockImplementation(async () => ({ connection })),
    disconnect: jest.fn().mockResolvedValue(undefined),
    connection,
    __updateOne: updateOne,
  };
});

import ensureDefaults from '../scripts/db/ensureDefaults';
const mongoose = require('mongoose') as any;

describe('ensureDefaults', () => {
  test('повторный запуск не создаёт дубли', async () => {
    process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
    await ensureDefaults();
    await ensureDefaults();
    expect(mongoose.__updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ upsert: true }),
    );
  });
});
