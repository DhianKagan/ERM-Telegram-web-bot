// Планировщик напоминаний для задач
// Модули: node-cron, telegramApi, messageQueue, config
import { schedule, ScheduledTask } from 'node-cron';
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from 'shared';

import { getChatId, chatId as staticChatId } from '../config';
import {
  storageCleanupCron,
  storageCleanupRetentionDays,
} from '../config/storage';
import { Task, User } from '../db/model';
import { removeDetachedFilesOlderThan } from './dataStorage';
import { enqueue } from './messageQueue';
import buildChatMessageLink from '../utils/messageLink';
import { call } from './telegramApi';

const resolveChatId = (): string | undefined =>
  typeof getChatId === 'function' ? getChatId() : staticChatId;

let reminderTask: ScheduledTask | undefined;
let cleanupTask: ScheduledTask | undefined;

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
  reminderTask = schedule(
    expr,
    async () => {
      const now = new Date();
      while (true) {
        const task = await Task.findOneAndUpdate(
          {
            remind_at: { $lte: now },
            status: { $ne: 'done' },
          },
          { $unset: { remind_at: '' } },
          { sort: { remind_at: 1 }, returnDocument: 'before' },
        ).lean();

        if (!task) {
          break;
        }

        const originalRemindAt = task.remind_at
          ? new Date(task.remind_at as unknown as string | number | Date)
          : null;

        try {
          const ids = new Set<number>();
          if (task.assigned_user_id) ids.add(task.assigned_user_id as number);
          if (Array.isArray(task.assignees))
            (task.assignees as number[]).forEach((id) => ids.add(id));
          let notified = false;
          for (const id of ids) {
            const user = await User.findOne({ telegram_id: id }).lean();
            if (user && user.receive_reminders !== false) {
              const groupChatId = resolveChatId();
              const link = buildChatMessageLink(
                groupChatId,
                task.telegram_message_id,
                task.telegram_topic_id,
              );
              const text = link
                ? `Напоминание: <a href="${link}">${task.title}</a>`
                : `Напоминание: ${task.title}`;
              await enqueue(() =>
                call('sendMessage', {
                  chat_id: user.telegram_id,
                  text,
                  parse_mode: link ? 'HTML' : undefined,
                  link_preview_options: link
                    ? { is_disabled: true }
                    : undefined,
                }),
              );
              notified = true;
            }
          }
          if (!notified) {
            const groupChatId = resolveChatId();
            if (groupChatId) {
              await enqueue(() =>
                call('sendMessage', {
                  chat_id: groupChatId,
                  text: `Напоминание: ${task.title}`,
                }),
              );
            }
          }
        } catch (error) {
          console.error('Не удалось отправить напоминание по задаче', error);
          if (originalRemindAt) {
            await Task.updateOne(
              { _id: task._id },
              { $set: { remind_at: originalRemindAt } },
            );
          }
        }
      }

      const reminderCutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS);
      const preferenceCache = new Map<number, boolean>();
      while (true) {
        const task = await Task.findOneAndUpdate(
          {
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
          },
          { $set: { deadline_reminder_sent_at: now } },
          { sort: { due_date: 1 }, returnDocument: 'before' },
        ).lean();

        if (!task) {
          break;
        }

        const previousReminderSentAt = task.deadline_reminder_sent_at
          ? new Date(
              task.deadline_reminder_sent_at as unknown as
                | string
                | number
                | Date,
            )
          : null;

        const restoreDeadlineReminder = async () => {
          if (previousReminderSentAt) {
            await Task.updateOne(
              { _id: task._id },
              { $set: { deadline_reminder_sent_at: previousReminderSentAt } },
            );
          } else {
            await Task.updateOne(
              { _id: task._id },
              { $unset: { deadline_reminder_sent_at: '' } },
            );
          }
        };

        try {
          const recipients = new Set<number>();
          if (typeof task.assigned_user_id === 'number') {
            recipients.add(task.assigned_user_id);
          }
          if (Array.isArray(task.assignees)) {
            (task.assignees as number[]).forEach((id) => recipients.add(id));
          }
          if (!recipients.size) {
            await restoreDeadlineReminder();
            continue;
          }

          const allowedRecipients: number[] = [];
          for (const userId of recipients) {
            if (!preferenceCache.has(userId)) {
              const user = await User.findOne({ telegram_id: userId }).lean();
              preferenceCache.set(
                userId,
                !user || user.receive_reminders !== false,
              );
            }
            if (preferenceCache.get(userId)) {
              allowedRecipients.push(userId);
            }
          }
          if (!allowedRecipients.length) {
            await restoreDeadlineReminder();
            continue;
          }

          const dueRaw = (task.due_date as unknown) ?? null;
          const dueDate = dueRaw
            ? new Date(dueRaw as string | number | Date)
            : null;
          if (!dueDate || Number.isNaN(dueDate.getTime())) {
            await restoreDeadlineReminder();
            continue;
          }

          const identifier =
            (task.task_number && String(task.task_number)) ||
            (task.request_id && String(task.request_id)) ||
            (typeof task._id === 'object' &&
            task._id !== null &&
            'toString' in task._id
              ? (task._id as { toString(): string }).toString()
              : String(task._id));
          const diffMs = dueDate.getTime() - now.getTime();
          const durationText = formatDuration(Math.abs(diffMs));
          const formattedDue = deadlineFormatter
            .format(dueDate)
            .replace(', ', ' ');
          const groupChatId = resolveChatId();
          const link = buildChatMessageLink(
            groupChatId,
            task.telegram_message_id,
            task.telegram_topic_id,
          );
          if (!link) {
            await restoreDeadlineReminder();
            continue;
          }
          const prefix = `Дедлайн задачи <a href="${link}">${identifier}</a>`;
          const base = `${prefix} — срок ${formattedDue} (${PROJECT_TIMEZONE_LABEL}), `;
          const messageText =
            diffMs <= 0
              ? `${base}просрочен на ${durationText}.`
              : `${base}время дедлайна через ${durationText}.`;

          const results = await Promise.allSettled(
            allowedRecipients.map((userId) =>
              enqueue(() =>
                call('sendMessage', {
                  chat_id: userId,
                  text: messageText,
                  parse_mode: link ? 'HTML' : undefined,
                  link_preview_options: { is_disabled: true },
                }),
              ),
            ),
          );
          results
            .filter((result) => result.status === 'rejected')
            .forEach((result) => {
              console.error(
                'Не удалось отправить напоминание о дедлайне',
                result,
              );
            });

          if (!results.some((result) => result.status === 'fulfilled')) {
            await restoreDeadlineReminder();
          }
        } catch (error) {
          console.error('Ошибка отправки напоминаний о дедлайне', error);
          await restoreDeadlineReminder();
        }
      }
    },
    { timezone: PROJECT_TIMEZONE },
  );

  if (storageCleanupRetentionDays > 0) {
    const retentionMs = storageCleanupRetentionDays * 24 * 60 * 60 * 1000;
    cleanupTask = schedule(
      storageCleanupCron,
      async () => {
        const cutoff = new Date(Date.now() - retentionMs);
        const removed = await removeDetachedFilesOlderThan(cutoff);
        if (removed > 0) {
          console.info('Очистка хранилища завершена, удалено файлов:', removed);
        }
      },
      { timezone: PROJECT_TIMEZONE },
    );
  }
}

export function stopScheduler(): void {
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = undefined;
  }
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = undefined;
  }
}
