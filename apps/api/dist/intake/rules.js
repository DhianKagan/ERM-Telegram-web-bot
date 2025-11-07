"use strict";
// Набор правил intake для автоматического дополнения задач.
// Основные модули: db/model.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rules = void 0;
exports.applyIntakeRules = applyIntakeRules;
// Простое правило: если в названии присутствует слово «срочно»,
// приоритет задачи становится «Срочно».
exports.rules = [
    {
        description: 'Устанавливает высокий приоритет, если в названии есть слово «срочно».',
        condition: (task) => /срочно/i.test(task.title || ''),
        action: (task) => {
            task.priority = 'Срочно';
        },
    },
];
// Применяет все правила к задаче.
function applyIntakeRules(task) {
    for (const r of exports.rules) {
        if (r.condition(task))
            r.action(task);
    }
}
