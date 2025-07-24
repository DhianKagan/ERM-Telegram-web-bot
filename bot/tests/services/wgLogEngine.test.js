process.env.BOT_TOKEN = 't'
process.env.CHAT_ID = '1'
process.env.JWT_SECRET = 's'
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db'
process.env.APP_URL = 'https://localhost'

jest.mock('../../src/db/model', () => {
  const sortSpy = jest.fn().mockReturnThis();
  const limitSpy = jest.fn();
  const findSpy = jest.fn(() => ({ sort: sortSpy, limit: limitSpy }));
  return { Log: { find: findSpy }, sortSpy, limitSpy, findSpy };
});

const { listLogs } = require('../../src/services/wgLogEngine');
const model = require('../../src/db/model');

beforeEach(() => {
  model.findSpy.mockClear();
  model.sortSpy.mockClear();
  model.limitSpy.mockClear();
});

test('неверный уровень не используется в фильтре', async () => {
  await listLogs({ level: 'bad', sort: 'level_desc' });
  expect(model.findSpy).toHaveBeenCalledWith({});
  expect(model.sortSpy).toHaveBeenCalledWith({ level: -1 });
  expect(model.limitSpy).toHaveBeenCalledWith(100);
});

