// Набор правил intake для автоматического дополнения задач.
// Основные модули: db/model.

import type { TaskDocument } from '../db/model';

interface Rule {
  description: string;
  condition: (task: Partial<TaskDocument>) => boolean;
  action: (task: Partial<TaskDocument>) => void;
}

// Простое правило: если в названии присутствует слово «срочно»,
// приоритет задачи становится «Срочно».
export const rules: Rule[] = [
  {
    description:
      'Устанавливает высокий приоритет, если в названии есть слово «срочно».',
    condition: (task) => /срочно/i.test(task.title || ''),
    action: (task) => {
      task.priority = 'Срочно';
    },
  },
];

// Применяет все правила к задаче.
export function applyIntakeRules(task: Partial<TaskDocument>) {
  for (const r of rules) {
    if (r.condition(task)) r.action(task);
  }
}
