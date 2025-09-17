// Назначение файла: планировщик обновления транспорта для всех флотов
// Основные модули: node-cron, сервис fleetVehicles
import { schedule, type ScheduledTask } from 'node-cron';
import { syncAllFleets } from './fleetVehicles';

let task: ScheduledTask | undefined;
let running = false;

async function runSync(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await syncAllFleets();
  } catch (error) {
    console.error('Ошибка синхронизации транспорта:', error);
  } finally {
    running = false;
  }
}

export function startFleetVehiclesScheduler(): void {
  if (process.env.DISABLE_FLEET_SYNC === '1') return;
  const expr = process.env.FLEET_SYNC_CRON || '*/5 * * * *';
  if (!task) {
    task = schedule(expr, runSync);
    void runSync();
  }
}

export function stopFleetVehiclesScheduler(): void {
  if (task) {
    task.stop();
    task = undefined;
  }
  running = false;
}
