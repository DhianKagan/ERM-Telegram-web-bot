// Назначение: поддельная реализация jsonwebtoken для тестов. Модули: jest.
const jwtMock = {
  sign: jest.fn(() => 'token'),
  verify: jest.fn(() => ({})),
  decode: jest.fn(() => ({ id: 5 })),
};
export = jwtMock;
