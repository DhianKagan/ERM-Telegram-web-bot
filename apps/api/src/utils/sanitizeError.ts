// Назначение: упрощённое представление ошибок без стека.
// Основные модули: стандартные типы.

export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name || 'Error';
    const message = err.message || '';
    return message ? name + ': ' + message : name;
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch (jsonErr) {
    return String(err);
  }
}

export default sanitizeError;

