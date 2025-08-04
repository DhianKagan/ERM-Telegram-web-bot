// Планировщик напоминаний для задач
// Модули: node-cron, telegramApi, messageQueue, config
import { schedule, ScheduledTask } from 'node-cron';
import { Task, User } from '../db/model';
import { call } from './telegramApi';
import { enqueue } from './messageQueue';
import { chatId } from '../config';

let task: ScheduledTask | undefined;

export function startScheduler(): void {
  const expr = process.env.SCHEDULE_CRON || '*/1 * * * *';
  task = schedule(expr, async () => {
    const tasks = await Task.find({
      remind_at: { $lte: new Date() },
      status: { $ne: 'done' },
    }).lean();
    for (const t of tasks) {
      const ids = new Set<number>();
      if (t.assigned_user_id) ids.add(t.assigned_user_id as number);
      if (Array.isArray(t.assignees))
        (t.assignees as number[]).forEach((id) => ids.add(id));
      let notified = false;
      for (const id of ids) {
        const user = await User.findOne({ telegram_id: id }).lean();
        if (user && user.receive_reminders !== false) {
          await enqueue(() =>
            call('sendMessage', {
              chat_id: user.telegram_id,
              text: `Напоминание: ${t.title}`,
            }),
          );
          notified = true;
        }
      }
      if (!notified) {
        await enqueue(() =>
          call('sendMessage', {
            chat_id: chatId,
            text: `Напоминание: ${t.title}`,
          }),
        );
      }
    }
    if (tasks.length) {
      await Task.updateMany(
        { _id: { $in: tasks.map((t) => t._id) } },
        { $unset: { remind_at: '' } },
      );
    }
  });
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = undefined;
  }
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = { startScheduler, stopScheduler };
