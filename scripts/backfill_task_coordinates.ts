// Назначение: заполнение координат логистических задач по адресам
// Основные модули: Task модель, геокодер
import mongoose from 'mongoose';
import { Task, type TaskDocument } from '../apps/api/src/db/model';
import { geocodeAddress } from '../apps/api/src/geo/geocoder';

const hasCoords = (
  value?: { lat?: number | null; lng?: number | null } | null,
) =>
  typeof value?.lat === 'number' &&
  Number.isFinite(value.lat) &&
  typeof value?.lng === 'number' &&
  Number.isFinite(value.lng);

const normalize = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed;
};

const collectTasks = () =>
  Task.find(
    {
      logistics_enabled: true,
      $and: [
        {
          $or: [
            { start_location: { $exists: true, $ne: '' } },
            { end_location: { $exists: true, $ne: '' } },
          ],
        },
        {
          $or: [
            { startCoordinates: { $exists: false } },
            { finishCoordinates: { $exists: false } },
            { startCoordinates: null },
            { finishCoordinates: null },
          ],
        },
      ],
    },
    {
      start_location: 1,
      end_location: 1,
      startCoordinates: 1,
      finishCoordinates: 1,
      title: 1,
    },
  ).lean();

const geocodeTask = async (task: TaskDocument) => {
  const startLocation = normalize(task.start_location);
  const endLocation = normalize(task.end_location);
  const shouldGeocodeStart = startLocation && !hasCoords(task.startCoordinates);
  const shouldGeocodeFinish = endLocation && !hasCoords(task.finishCoordinates);
  if (!shouldGeocodeStart && !shouldGeocodeFinish) {
    return null;
  }

  const updates: Partial<TaskDocument> = {};
  if (shouldGeocodeStart) {
    const coords = await geocodeAddress(startLocation);
    if (coords) {
      updates.startCoordinates = coords;
    }
  }
  if (shouldGeocodeFinish) {
    const coords = await geocodeAddress(endLocation);
    if (coords) {
      updates.finishCoordinates = coords;
    }
  }
  return Object.keys(updates).length ? updates : null;
};

const applyUpdates = async (taskId: string, updates: Partial<TaskDocument>) => {
  await Task.updateOne({ _id: taskId }, { $set: updates }).exec();
};

async function main() {
  const tasks = await collectTasks();
  if (!tasks.length) {
    console.log('Логистических задач без координат не найдено');
    await mongoose.disconnect();
    return;
  }

  console.log(`Найдено задач для геокодирования: ${tasks.length}`);
  let success = 0;
  for (const task of tasks) {
    const updates = await geocodeTask(task as TaskDocument);
    if (!updates) {
      continue;
    }
    await applyUpdates(String(task._id), updates);
    success += 1;
    const label = normalize(task.title) || String(task._id);
    console.log(`Геокодирована задача: ${label}`);
  }
  console.log(`Обновлено задач: ${success}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Ошибка при заполнении координат:', error);
  await mongoose.disconnect();
  process.exit(1);
});
