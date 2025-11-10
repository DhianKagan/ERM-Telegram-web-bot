// Назначение: упрощённое представление ошибок без стека.
// Основные модули: стандартные типы.

export default function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}
