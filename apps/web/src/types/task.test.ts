// Назначение: проверки корректности типов задач
// Модули: HistoryItem, UserBrief, Attachment
import type { HistoryItem, UserBrief, Attachment } from "./task";

const history: HistoryItem[] = [
  {
    changed_at: "2024-01-01T00:00:00Z",
    changed_by: 1,
    changes: {
      from: { status: "Новая" },
      to: { status: "В работе" },
    },
  },
];

const users: UserBrief[] = [{ telegram_id: 1, name: "Иван" }];

const attachments: Attachment[] = [
  { name: "f.txt", url: "/f.txt", type: "text/plain", size: 1 },
];

// предотвращаем удаление при компиляции
export { history, users, attachments };
