// Назначение: автотесты. Модули: jest, supertest.
// Тесты маршрута /api/v1/users
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const express = require('express');
const rateLimit = require('express-rate-limit');
const request = require('supertest');
const { stopScheduler } = require('../src/services/scheduler');
const { stopQueue } = require('../src/services/messageQueue');
const { ACCESS_ADMIN, ACCESS_MANAGER } = require('../src/utils/accessMask');

jest.mock('../src/db/queries', () => ({
  listUsers: jest.fn(async () => [{ telegram_id: 1, username: 'test' }]),
  generateUserCredentials: jest.fn(async (id?: string | number, username?: string) => ({
    telegramId:
      id !== undefined && id !== null && String(id) !== ''
        ? Number(id)
        : 2,
    username: username && username.trim() ? username : 'generated_user',
  })),
  createUser: jest.fn(async () => ({ telegram_id: 1, username: 'test' })),
  updateUser: jest.fn(async () => ({ telegram_id: 1, username: 'new' })),
  getUser: jest.fn(async (id: string) =>
    id === '1' ? { telegram_id: 1, username: 'test' } : null,
  ),
  accessByRole: (r: string) => (r === 'admin' ? 6 : r === 'manager' ? 4 : 1),
}));

jest.mock('../src/api/middleware', () => ({
  verifyToken: (req, _res, next) => {
    req.user = {
      role: req.headers['x-role'],
      access: Number(req.headers['x-access']) || 1,
      telegram_id: 1,
    };
    next();
  },
  checkRole: (expected) => (req, res, next) => {
    if (typeof expected === 'number') {
      return (req.user.access & expected) === expected
        ? next()
        : res.sendStatus(403);
    }
    return req.user.role === expected ? next() : res.sendStatus(403);
  },
  asyncHandler: (fn) => fn,
  errorHandler: (err, _req, res, _next) =>
    res.status(500).json({ error: err.message }),
}));

const {
  listUsers,
  createUser,
  updateUser,
  getUser,
  generateUserCredentials,
} = require('../src/db/queries');
const {
  verifyToken,
  checkRole,
  asyncHandler,
} = require('../src/api/middleware');
const validateDto = require('../src/middleware/validateDto.ts').default;
const { CreateUserDto, UpdateUserDto } = require('../src/dto/users.dto.ts');

const app = express();
app.use(express.json());
const usersRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.get(
  '/api/v1/users',
  usersRateLimiter,
  verifyToken,
  checkRole(ACCESS_ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);
app.get(
  '/api/v1/users/:id',
  usersRateLimiter,
  verifyToken,
  asyncHandler(async (req, res) => {
    const user = await getUser(req.params.id);
    if (!user) {
      res.sendStatus(404);
      return;
    }
    res.json({ ...user, username: String(user.telegram_id) });
  }),
);
app.post(
  '/api/v1/users',

  usersRateLimiter,

  verifyToken,
  checkRole(ACCESS_ADMIN),
  ...validateDto(CreateUserDto),
  asyncHandler(async (req, res) => {
    const rawId = req.body.id;
    const rawUsername = req.body.username;
    const rawRoleId = req.body.roleId;

    const normalizedId =
      typeof rawId === 'string'
        ? rawId.trim() || undefined
        : rawId !== undefined
        ? rawId
        : undefined;

    const normalizedUsername =
      typeof rawUsername === 'string'
        ? rawUsername.trim() || undefined
        : rawUsername !== undefined
        ? String(rawUsername)
        : undefined;

    const normalizedRoleId =
      typeof rawRoleId === 'string'
        ? rawRoleId.trim() || undefined
        : rawRoleId;

    if (req.query.preview === 'true' || req.query.preview === '1') {
      const generatedPreview = await generateUserCredentials(
        normalizedId,
        normalizedUsername,
      );
      res.json({
        telegram_id: generatedPreview.telegramId,
        username: generatedPreview.username,
      });
      return;
    }

    const generated = await generateUserCredentials(
      normalizedId,
      normalizedUsername,
    );
    const createdUser = await createUser(
      generated.telegramId,
      generated.username,
      normalizedRoleId,
    );
    res.status(201).json(createdUser);
  }),
);
app.patch(
  '/api/v1/users/:id',
  usersRateLimiter,
  verifyToken,
  checkRole(ACCESS_ADMIN),
  ...validateDto(UpdateUserDto),
  asyncHandler(async (req, res) => {
    res.json(await updateUser(req.params.id, req.body));
  }),
);

afterAll(() => {
  stopScheduler();
  stopQueue();
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('админ получает список пользователей', async () => {
  const res = await request(app)
    .get('/api/v1/users')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER));
  expect(res.status).toBe(200);
  expect(res.body[0].username).toBe('test');
});

test('менеджер получает 403', async () => {
  const res = await request(app)
    .get('/api/v1/users')
    .set('x-role', 'manager')
    .set('x-access', '4');
  expect(res.status).toBe(403);
});

test('обычный пользователь получает 403', async () => {
  const res = await request(app)
    .get('/api/v1/users')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(403);
});

test('создание пользователя без id вызывает генератор', async () => {
  const res = await request(app)
    .post('/api/v1/users')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER))
    .send({});
  expect(res.status).toBe(201);
  expect(generateUserCredentials).toHaveBeenCalledWith(undefined, undefined);
  expect(createUser).toHaveBeenCalledWith(2, 'generated_user', undefined);
});

test('предпросмотр возвращает сгенерированные данные', async () => {
  const res = await request(app)
    .post('/api/v1/users?preview=1')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER))
    .send({});
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ telegram_id: 2, username: 'generated_user' });
  expect(createUser).not.toHaveBeenCalled();
});

test('обновление пользователя', async () => {
  const res = await request(app)
    .patch('/api/v1/users/1')
    .set('x-role', 'admin')
    .set('x-access', String(ACCESS_ADMIN | ACCESS_MANAGER))
    .send({ username: 'new' });
  expect(res.status).toBe(200);
  expect(updateUser).toHaveBeenCalled();
});

test('пользователь получает карточку сотрудника', async () => {
  const res = await request(app)
    .get('/api/v1/users/1')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(200);
  expect(getUser).toHaveBeenCalledWith('1');
  expect(res.body.username).toBe('1');
});

test('карточка сотрудника не найдена', async () => {
  const res = await request(app)
    .get('/api/v1/users/2')
    .set('x-role', 'user')
    .set('x-access', '1');
  expect(res.status).toBe(404);
});
