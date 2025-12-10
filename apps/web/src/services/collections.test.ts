/** @jest-environment jsdom */
// Назначение файла: проверяет загрузку всех страниц коллекций
// Основные модули: jest, fetchAllCollectionItems
import authFetch from '../utils/authFetch';
import {
  fetchAllCollectionItems,
  fetchCollectionObjects,
  createCollectionObject,
  updateCollectionObject,
  toCollectionObject,
  type CollectionItem,
} from './collections';

jest.mock('../utils/authFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;

const createResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

describe('fetchAllCollectionItems', () => {
  beforeEach(() => {
    mockedAuthFetch.mockReset();
  });

  it('загружает все страницы пока не будет получено нужное количество', async () => {
    mockedAuthFetch
      .mockResolvedValueOnce(
        createResponse({
          items: [
            { _id: 'a', type: 'departments', name: 'A', value: '' },
            { _id: 'b', type: 'departments', name: 'B', value: '' },
          ],
          total: 3,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          items: [{ _id: 'c', type: 'departments', name: 'C', value: '' }],
          total: 3,
        }),
      );

    const result = await fetchAllCollectionItems('departments', '', 2);

    expect(result).toHaveLength(3);
    expect(result.map((item) => item._id)).toEqual(['a', 'b', 'c']);
    expect(mockedAuthFetch).toHaveBeenCalledTimes(2);
  });

  it('останавливается, если страница вернула меньше элементов, чем лимит', async () => {
    mockedAuthFetch.mockResolvedValue(
      createResponse({
        items: [{ _id: 'a', type: 'departments', name: 'A', value: '' }],
        total: 10,
      }),
    );

    const result = await fetchAllCollectionItems('departments', '', 50);

    expect(result).toHaveLength(1);
    expect(mockedAuthFetch).toHaveBeenCalledTimes(1);
  });

  it('приводит адрес и координаты из meta.location', () => {
    const item: CollectionItem = {
      _id: 'obj-1',
      type: 'objects',
      name: 'Склад',
      value: '',
      meta: { address: 'ул. Тестовая, 1', location: { lat: 10.1, lng: 20.2 } },
    };

    const normalized = toCollectionObject(item);

    expect(normalized.address).toBe('ул. Тестовая, 1');
    expect(normalized.latitude).toBe(10.1);
    expect(normalized.longitude).toBe(20.2);
  });

  it('загружает объекты с координатами', async () => {
    mockedAuthFetch.mockResolvedValue(
      createResponse({
        items: [
          {
            _id: 'obj-2',
            type: 'objects',
            name: 'Офис',
            value: 'Киев, Крещатик 1',
            meta: { latitude: 50.45, longitude: 30.523 },
          },
        ],
        total: 1,
      }),
    );

    const result = await fetchCollectionObjects('офис', 2, 5);

    expect(mockedAuthFetch).toHaveBeenCalledWith(
      '/api/v1/collections?type=objects&page=2&limit=5&search=%D0%BE%D1%84%D0%B8%D1%81',
    );
    expect(result.items[0].address).toBe('Киев, Крещатик 1');
    expect(result.items[0].latitude).toBe(50.45);
    expect(result.items[0].longitude).toBe(30.523);
    expect(result.total).toBe(1);
  });

  it('создаёт объект с адресом и координатами', async () => {
    mockedAuthFetch.mockResolvedValue(createResponse({ _id: 'new-object' }));

    await createCollectionObject({
      name: 'Склад север',
      address: 'Днепр, улица Тестовая 5',
      latitude: 48.45,
      longitude: 35.05,
    });

    const [, options] = mockedAuthFetch.mock.calls[0];
    const payload = JSON.parse((options as RequestInit).body as string);

    expect(payload.type).toBe('objects');
    expect(payload.name).toBe('Склад север');
    expect(payload.value).toBe('Днепр, улица Тестовая 5');
    expect(payload.meta).toEqual({
      address: 'Днепр, улица Тестовая 5',
      latitude: 48.45,
      longitude: 35.05,
      location: { lat: 48.45, lng: 35.05 },
    });
  });

  it('обновляет объект и очищает координаты при пустых значениях', async () => {
    mockedAuthFetch.mockResolvedValue(createResponse({ _id: 'obj-3' }));

    await updateCollectionObject('obj-3', {
      name: 'База',
      address: 'Харьков, ул. Примерная 10',
    });

    const [, options] = mockedAuthFetch.mock.calls[0];
    const payload = JSON.parse((options as RequestInit).body as string);

    expect(payload.name).toBe('База');
    expect(payload.value).toBe('Харьков, ул. Примерная 10');
    expect(payload.meta).toEqual({
      address: 'Харьков, ул. Примерная 10',
    });
  });
});
