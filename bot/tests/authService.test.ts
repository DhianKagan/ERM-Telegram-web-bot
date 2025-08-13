// Назначение: автотесты. Модули: jest, supertest.
// Тесты сервиса авторизации
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

jest.mock('../src/services/otp', () => ({
  sendCode: jest.fn(),
  sendAdminCode: jest.fn(),
  verifyCode: jest.fn(() => true),
  verifyAdminCode: jest.fn(() => true),
  codes: new Map(),
  adminCodes: new Map(),
}));
jest.mock('../src/db/queries', () => ({
  getUser: jest.fn(() => null),
  createUser: jest.fn(async () => ({ username: 'u' })),
  updateUser: jest.fn(),
}));
jest.mock('../src/services/userInfoService', () => ({
  getMemberStatus: jest.fn(async () => 'member'),
}));
jest.mock('../src/services/service', () => ({ writeLog: jest.fn() }));
jest.mock('../src/utils/verifyInitData', () =>
  jest.fn(() => ({ user: { id: 4, username: 'u' } })),
);

const service = require('../src/auth/auth.service.ts').default;
const queries = require('../src/db/queries');
const otp = require('../src/services/otp');
const verifyInit = require('../src/utils/verifyInitData');
const { writeLog } = require('../src/services/service');

beforeEach(() => {
  otp.codes.clear();
  otp.adminCodes.clear();
  jest.clearAllMocks();
});

test('sendCode использует adminCodes для админа', async () => {
  queries.getUser.mockResolvedValueOnce({
    roleId: require('../src/config').adminRoleId,
  });
  await service.sendCode('1');
  expect(otp.sendAdminCode).toHaveBeenCalledWith({ telegramId: 1 });
});

test('sendCode вызывает sendCode для обычного пользователя', async () => {
  queries.getUser.mockResolvedValueOnce(null);
  await service.sendCode('2');
  expect(otp.sendCode).toHaveBeenCalledWith({ telegramId: 2 });
});

test('verifyCode создаёт пользователя при отсутствии', async () => {
  otp.verifyCode.mockReturnValueOnce(true);
  const token = await service.verifyCode('3', '123', 'u');
  expect(queries.createUser).toHaveBeenCalled();
  expect(typeof token).toBe('string');
  expect(writeLog).toHaveBeenCalledWith('Вход пользователя 3/u');
});

test('verifyInitData создаёт пользователя и возвращает токен', async () => {
  const data = 'user=%7B%22id%22%3A4%2C%22username%22%3A%22u%22%7D';
  verifyInit.mockReturnValueOnce({ user: { id: 4, username: 'u' } });
  const token = await service.verifyInitData(data);
  expect(queries.createUser).toHaveBeenCalled();
  expect(typeof token).toBe('string');
});

test('verifyInitData выбрасывает ошибку при неверных данных', async () => {
  verifyInit.mockImplementationOnce(() => {
    throw new Error('bad');
  });
  await expect(service.verifyInitData('bad')).rejects.toThrow('invalid initData');
});
