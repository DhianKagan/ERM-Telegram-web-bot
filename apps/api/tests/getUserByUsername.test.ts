process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.JWT_SECRET = 's';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';

const mockFindOneExec = jest.fn();
const mockFindExec = jest.fn();

const mockFindOne = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  then: (
    resolve: (value: unknown) => unknown,
    reject?: (error: unknown) => unknown,
  ) => mockFindOneExec().then(resolve, reject),
  catch: (reject: (error: unknown) => unknown) =>
    mockFindOneExec().catch(reject),
}));

const mockFind = jest.fn(() => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  then: (
    resolve: (value: unknown) => unknown,
    reject?: (error: unknown) => unknown,
  ) => mockFindExec().then(resolve, reject),
  catch: (reject: (error: unknown) => unknown) => mockFindExec().catch(reject),
}));

jest.mock('../src/db/model', () => ({
  User: {
    findOne: mockFindOne,
    find: mockFind,
  },
  Role: { findById: jest.fn(async () => null) },
}));

jest.mock('../src/db/roleCache', () => ({
  resolveRoleId: jest.fn(async () => null),
  clearRoleCache: jest.fn(),
}));

import { getUserByUsername } from '../src/db/queries';

describe('getUserByUsername', () => {
  beforeEach(() => {
    mockFindOne.mockClear();
    mockFind.mockClear();
    mockFindOneExec.mockReset();
    mockFindExec.mockReset();
  });

  test('returns exact username match before case-insensitive fallback', async () => {
    const exactUser = { _id: '1', username: 'TestUser' };
    mockFindOneExec.mockResolvedValue(exactUser);

    const result = await getUserByUsername('TestUser');

    expect(result).toEqual(exactUser);
    expect(mockFindOne).toHaveBeenCalledWith({ username: 'TestUser' });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test('returns null when case-insensitive lookup is ambiguous', async () => {
    mockFindOneExec.mockResolvedValue(null);
    mockFindExec.mockResolvedValue([
      { _id: '1', username: 'User' },
      { _id: '2', username: 'user' },
    ]);

    const result = await getUserByUsername('USER');

    expect(result).toBeNull();
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  test('returns single case-insensitive match when unique', async () => {
    const matchedUser = { _id: '1', username: 'User' };
    mockFindOneExec.mockResolvedValue(null);
    mockFindExec.mockResolvedValue([matchedUser]);

    const result = await getUserByUsername('USER');

    expect(result).toEqual(matchedUser);
  });
});
