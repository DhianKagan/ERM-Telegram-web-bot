/**
 * Назначение файла: проверка, что модель AuthUser поддерживает роль manager.
 * Основные модули: AuthUserModel из apps/api/src/models/User.
 */
import AuthUserModel from '../apps/api/src/models/User';

test('модель допускает роль manager', () => {
  const roles = (AuthUserModel.schema.path('role') as any).enumValues;
  expect(roles).toContain('manager');
});
