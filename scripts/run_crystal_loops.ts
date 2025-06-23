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

export function runRepoCrystallization() {
  const ok = runChecks();
  const m = new Manager();
  const score = ok ? 0.95 : 0.7;
  m.data.tasks.forEach(t => m.updateKPI(t.id, score, 'auto loop'));
  m.average();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRepoCrystallization();
}
