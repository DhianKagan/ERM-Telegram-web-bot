process.env.APP_URL = 'https://localhost';

jest.mock('../src/services/route', () => ({
  getRouteDistance: jest.fn(),
}));

describe('getOsrmDistance', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('возвращает расстояние в км без округления до 0.1', async () => {
    const { getRouteDistance } = await import('../src/services/route');
    (getRouteDistance as jest.Mock).mockResolvedValue({ distance: 1234.56 });

    const { getOsrmDistance } = await import('../src/geo/osrm');
    const result = await getOsrmDistance({
      start: { lat: 50.45, lng: 30.52 },
      finish: { lat: 50.46, lng: 30.53 },
    });

    expect(result).toBeCloseTo(1.23456, 5);
  });
});
