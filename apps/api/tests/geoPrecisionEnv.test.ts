const originalEnv = { ...process.env };

describe('geo precision env validation', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  test('игнорирует нецелое ROUTE_PRECISION_DECIMALS и использует дефолтную точность', async () => {
    process.env.ROUTE_PRECISION_DECIMALS = '2.5';

    const { parsePointInput } = await import('@erm/utils');
    const result = parsePointInput({ lat: 50.1234567, lng: 30.7654321 });

    expect(result).toEqual({ lat: 50.123457, lng: 30.765432 });
  });
});
