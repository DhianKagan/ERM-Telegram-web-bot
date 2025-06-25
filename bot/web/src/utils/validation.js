// Утилита проверки ссылок с использованием пакета validator
import isURL from "validator/lib/isURL";

export function validateURL(url) {
  try {
    return isURL(url, { require_protocol: true }) ? url.trim() : "";
  } catch {
    return "";
  }
}
