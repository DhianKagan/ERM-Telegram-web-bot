const { verifyAdmin } = require('./auth');

describe('Auth Tests', () => {
  test('verifyAdmin should return true for admin user', () => {
    expect(verifyAdmin(1)).toBe(true);
  });

  test('verifyAdmin should return false for non-admin user', () => {
    expect(verifyAdmin(2)).toBe(false);
  });
});
