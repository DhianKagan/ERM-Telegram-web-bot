// Назначение: обёртка вокруг checkRole для проверки роли
// Основные модули: middleware/checkRole
import checkRole from './checkRole';

export default function requireRole(role: string) {
  return checkRole(role);
}
