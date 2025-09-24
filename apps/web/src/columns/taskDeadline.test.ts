// Назначение файла: юнит-тесты утилит расчёта сроков задач.
// Основные модули: Jest, taskDeadline.

import { formatDurationShort, getDeadlineState } from "./taskDeadline";

describe("getDeadlineState", () => {
  const start = "2024-01-01T00:00:00.000Z";
  const due = "2024-01-11T00:00:00.000Z";

  it("возвращает зелёный уровень при запасе свыше 60%", () => {
    const state = getDeadlineState(start, due, new Date("2024-01-02T00:00:00.000Z"));
    expect(state.kind).toBe("countdown");
    if (state.kind !== "countdown") throw new Error("state kind mismatch");
    expect(state.level).toBe("safe");
    expect(state.ratio).toBeCloseTo(0.9, 3);
  });

  it("возвращает жёлтый уровень при остатке между 20% и 59%", () => {
    const state = getDeadlineState(start, due, new Date("2024-01-07T00:00:00.000Z"));
    expect(state.kind).toBe("countdown");
    if (state.kind !== "countdown") throw new Error("state kind mismatch");
    expect(state.level).toBe("warn");
    expect(state.ratio).toBeCloseTo(0.4, 3);
  });

  it("возвращает оранжевый уровень при остатке менее 20%", () => {
    const state = getDeadlineState(start, due, new Date("2024-01-10T00:00:00.000Z"));
    expect(state.kind).toBe("countdown");
    if (state.kind !== "countdown") throw new Error("state kind mismatch");
    expect(state.level).toBe("danger");
    expect(state.ratio).toBeCloseTo(0.1, 3);
  });

  it("фиксирует просрочку при дате в прошлом", () => {
    const state = getDeadlineState(start, due, new Date("2024-01-12T00:00:00.000Z"));
    expect(state.kind).toBe("overdue");
  });

  it("обрабатывает отсутствие срока", () => {
    const state = getDeadlineState(start, undefined, new Date("2024-01-02T00:00:00.000Z"));
    expect(state.kind).toBe("invalid");
  });

  it("сигнализирует об обратном диапазоне", () => {
    const state = getDeadlineState(
      "2024-01-20T00:00:00.000Z",
      "2024-01-10T00:00:00.000Z",
      new Date("2024-01-05T00:00:00.000Z"),
    );
    expect(state.kind).toBe("pending");
    if (state.kind !== "pending") throw new Error("state kind mismatch");
    expect(state.issue).toBe("invalid-range");
  });
});

describe("formatDurationShort", () => {
  it("возвращает два значимых компонента", () => {
    expect(formatDurationShort(5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)).toBe("5д 3ч");
  });

  it("возвращает минуты при коротком интервале", () => {
    expect(formatDurationShort(5 * 60 * 1000)).toBe("5м");
  });

  it("корректно форматирует отрицательные значения", () => {
    expect(formatDurationShort(-90 * 60 * 1000)).toBe("1ч 30м");
  });

  it("возвращает специальную метку для интервалов меньше минуты", () => {
    expect(formatDurationShort(20 * 1000)).toBe("<1м");
  });
});

