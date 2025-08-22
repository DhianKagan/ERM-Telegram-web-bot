// Назначение: проверка ссылок с использованием validator
// Основные модули: validator/lib/isURL
import isURL from "validator/lib/isURL";

export function validateURL(url: string): string {
  try {
    return isURL(url, { require_protocol: true }) ? url.trim() : "";
  } catch {
    return "";
  }
}
