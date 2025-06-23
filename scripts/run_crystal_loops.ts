/**
 * Запуск лупов кристаллизации для всего репозитория.
 * Модули: child_process для вызова тестов и eslint,
 *          crystallizationManager.ts для обновления KPI.
 */
import { execSync } from 'child_process';
import { Manager } from '../crystallizationManager';
import { pathToFileURL } from 'url';

function runChecks(): boolean {
  try {
    execSync('npx eslint bot/src', { stdio: 'inherit' });
    execSync('npm test --prefix bot', { stdio: 'inherit' });
    return true;
  } catch (e) {
    return false;
  }
}

export function runRepoCrystallization(target = 99) {
  const m = new Manager();
  let avg = m.average();
  while (avg < target) {
    const ok = runChecks();
    m.data.tasks.forEach((t) => {
      const delta = ok ? 0.01 : -0.05;
      const score = Math.max(0, Math.min(1, +(t.final_score + delta).toFixed(2)));
      m.updateKPI(t.id, score, ok ? 'auto loop success' : 'auto loop fail');
    });
    avg = m.average();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRepoCrystallization();
}
