// Назначение: поддельная реализация jsonwebtoken для тестов. Модули: jest.
const jwtMock = { sign: () => 'token', decode: () => ({ id: 5 }) };
export = jwtMock;
