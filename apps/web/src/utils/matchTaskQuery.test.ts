// Назначение файла: проверяет сопоставление задач с поисковым запросом
// Модули: matchTaskQuery, taskColumns (тип TaskRow)
import matchTaskQuery from "./matchTaskQuery";
import type { TaskRow } from "../columns/taskColumns";

const baseTask = (): TaskRow => ({
  _id: "task-1",
  id: "task-1",
  title: "Доставить документы",
  status: "Новая",
  assignees: [101],
  request_id: "REQ-2024",
  task_number: "000123",
  task_description: "Доставить документы клиенту",
  project: "Ромашка",
  custom: { client: "ООО Ромашка", contact: "Анна" },
});

const users = {
  101: {
    name: "Семенович Виктор",
    username: "semenovich",
    telegram_username: "semenovich_v",
  },
  102: {
    name: "Иванова Анна",
    username: "anna",
  },
};

describe("matchTaskQuery", () => {
  it("находит совпадение по заголовку", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "доставить", users)).toBe(true);
  });

  it("находит совпадение по имени пользователя", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "виктор", users)).toBe(true);
  });

  it("ищет по пользовательскому полю", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "ромашка", users)).toBe(true);
  });

  it("учитывает все слова в запросе", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "доставить виктор", users)).toBe(true);
    expect(matchTaskQuery(task, "доставить петр", users)).toBe(false);
  });

  it("находит совпадение по идентификатору без символов", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "req2024", users)).toBe(true);
  });

  it("возвращает false при отсутствии совпадений", () => {
    const task = baseTask();
    expect(matchTaskQuery(task, "несуществующий запрос", users)).toBe(false);
  });
});
