/** @jest-environment jsdom */
// Назначение файла: проверяет загрузку всех страниц коллекций
// Основные модули: jest, fetchAllCollectionItems
import authFetch from '../utils/authFetch';
import { fetchAllCollectionItems } from './collections';

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
});
