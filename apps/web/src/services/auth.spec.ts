/* eslint-env jest */
import authFetch from '../utils/authFetch';
import { setAccessToken } from '../lib/auth';
import { refresh } from './auth';

jest.mock('../utils/authFetch', () => jest.fn());

jest.mock('../lib/auth', () => ({
  clearAccessToken: jest.fn(),
  setAccessToken: jest.fn(),
}));

describe('auth service refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('сохраняет legacy token из refresh-ответа rollout-ветки', async () => {
    (authFetch as jest.MockedFunction<typeof authFetch>).mockResolvedValue({
      json: async () => ({ token: 'legacy-token' }),
    } as Response);

    await refresh();

    expect(setAccessToken).toHaveBeenCalledWith('legacy-token');
  });
});
