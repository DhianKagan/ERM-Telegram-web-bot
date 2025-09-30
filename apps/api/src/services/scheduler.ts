// Планировщик напоминаний для задач
// Модули: node-cron, telegramApi, messageQueue, config
import { schedule, ScheduledTask } from 'node-cron';
import { Task, User } from '../db/model';
import { call } from './telegramApi';
import { enqueue } from './messageQueue';
import { chatId } from '../config';
import buildChatMessageLink from '../utils/messageLink';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';

let task: ScheduledTask | undefined;

const REMINDER_INTERVAL_MS = 60 * 60 * 1000;

const deadlineFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const plural = (value: number, forms: [string, string, string]) => {
  const abs = Math.abs(value) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (mod10 > 1 && mod10 < 5) return forms[1];
  if (mod10 === 1) return forms[0];
  return forms[2];
};

const formatDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  parts.push(`${days} ${plural(days, ['день', 'дня', 'дней'])}`);
  parts.push(`${hours} ${plural(hours, ['час', 'часа', 'часов'])}`);
  parts.push(`${minutes} ${plural(minutes, ['минута', 'минуты', 'минут'])}`);
  return parts.join(' ');
};

export function startScheduler(): void {
  const expr = process.env.SCHEDULE_CRON || '0 * * * *';
  task = schedule(expr, async () => {
    const now = new Date();
    const tasks = await Task.find({
      remind_at: { $lte: now },
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

    const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);
    const deadlineTasks = await Task.find({
      due_date: { $exists: true, $ne: null },
      status: { $nin: ['Выполнена', 'Отменена'] },
      $and: [
        {
          $or: [
            { deadline_reminder_sent_at: { $exists: false } },
            { deadline_reminder_sent_at: { $lte: reminderCutoff } },
          ],
        },
        {
          $or: [
            { assignees: { $exists: true, $ne: [] } },
            { assigned_user_id: { $exists: true } },
          ],
        },
      ],
    }).lean();

    if (deadlineTasks.length) {
      const processedIds: string[] = [];
      const preferenceCache = new Map<number, boolean>();
      for (const t of deadlineTasks) {
        const recipients = new Set<number>();
        if (typeof t.assigned_user_id === 'number') {
          recipients.add(t.assigned_user_id);
        }
        if (Array.isArray(t.assignees)) {
          (t.assignees as number[]).forEach((id) => recipients.add(id));
        }
        if (!recipients.size) continue;

        const allowedRecipients: number[] = [];
        for (const userId of recipients) {
          if (!preferenceCache.has(userId)) {
            const user = await User.findOne({ telegram_id: userId }).lean();
            preferenceCache.set(userId, !user || user.receive_reminders !== false);
          }
          if (preferenceCache.get(userId)) {
            allowedRecipients.push(userId);
          }
        }
        if (!allowedRecipients.length) continue;

        const dueRaw = (t.due_date as unknown) ?? null;
        const dueDate = dueRaw ? new Date(dueRaw as string | number | Date) : null;
        if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

        const identifier =
          (t.task_number && String(t.task_number)) ||
          (t.request_id && String(t.request_id)) ||
          (typeof t._id === 'object' && t._id !== null && 'toString' in t._id
            ? (t._id as { toString(): string }).toString()
            : String(t._id));
        const diffMs = dueDate.getTime() - now.getTime();
        const durationText = formatDuration(Math.abs(diffMs));
        const formattedDue = deadlineFormatter.format(dueDate).replace(', ', ' ');
        const link = buildChatMessageLink(chatId, t.telegram_message_id);
        if (!link) continue;
        const prefix = `Дедлайн задачи <a href="${link}">${identifier}</a>`;
        const base = `${prefix} — срок ${formattedDue} (${PROJECT_TIMEZONE_LABEL}), `;
        const messageText =
          diffMs <= 0
            ? `${base}просрочен на ${durationText}.`
            : `${base}время дедлайна через ${durationText}.`;

        await Promise.allSettled(
          allowedRecipients.map((userId) =>
            enqueue(() =>
              call('sendMessage', {
                chat_id: userId,
                text: messageText,
                parse_mode: link ? 'HTML' : undefined,
                link_preview_options: { is_disabled: true },
              }),
            ).catch((error) => {
              console.error(
                `Не удалось отправить напоминание пользователю ${userId}`,
                error,
              );
            }),
          ),
        );

        const id =
          typeof t._id === 'object' && t._id !== null && 'toString' in t._id
            ? (t._id as { toString(): string }).toString()
            : String(t._id);
        processedIds.push(id);
      }

      if (processedIds.length) {
        await Task.updateMany(
          { _id: { $in: processedIds } },
          { $set: { deadline_reminder_sent_at: now } },
        );
      }
    }
  });
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = undefined;
  }
}
