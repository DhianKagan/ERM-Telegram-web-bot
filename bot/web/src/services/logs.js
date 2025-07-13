// Запросы к API логов
import authFetch from "../utils/authFetch";

export const createLog = (message) =>
  authFetch("/api/v1/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });

