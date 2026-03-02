process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret';
process.env.BOT_TOKEN = 't';
process.env.CHAT_ID = '1';
process.env.MONGO_DATABASE_URL = 'mongodb://localhost/db';
process.env.APP_URL = 'https://localhost';
process.env.REDIS_URL = '';
process.env.QUEUE_REDIS_URL = '';

import {
  issueSession,
  rotateSession,
  verifyAccessToken,
  tokenSettings,
} from '../src/services/token.service';
import { __resetRefreshStoreForTests } from '../src/services/refreshStore';

describe('token service', () => {
  beforeEach(() => {
    __resetRefreshStoreForTests();
  });

  test('issueSession выпускает access и refresh', async () => {
    const session = await issueSession({
      id: '1',
      username: 'u',
      role: 'user',
      access: 1,
      is_service_account: false,
    });
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(tokenSettings.refreshCookieName).toBeTruthy();
    expect(() => verifyAccessToken(session.accessToken)).not.toThrow();
  });

  test('rotateSession отклоняет невалидный refresh', async () => {
    const reused = await rotateSession('broken-refresh-token');
    expect(reused).toBeNull();
  });
});
