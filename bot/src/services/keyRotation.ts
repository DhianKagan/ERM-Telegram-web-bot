// Назначение: планировщик пересоздания ключей
// Модули: node-cron, secretsManager
import { schedule, ScheduledTask } from 'node-cron';
import { rotateSecret } from './secretsManager';

let task: ScheduledTask | undefined;

export function startKeyRotation(): void {
  const expr = process.env.KEY_ROTATION_CRON || '0 0 * * *';
  const name = process.env.AWS_SECRET_ID || process.env.VAULT_SECRET_PATH;
  if (!name) return;
  task = schedule(expr, async () => {
    await rotateSecret(name);
  });
}

export function stopKeyRotation(): void {
  task?.stop();
  task = undefined;
}
