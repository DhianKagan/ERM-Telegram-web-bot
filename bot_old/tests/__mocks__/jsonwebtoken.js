// Поддельная реализация jsonwebtoken для тестов.
module.exports = { sign: () => 'token', decode: () => ({ id: 5 }) }
