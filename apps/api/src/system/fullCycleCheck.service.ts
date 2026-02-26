import type { Request } from 'express';
import { generateShortToken } from '../auth/auth';
import { User } from '../db/model';
import { ACCESS_MANAGER, ACCESS_TASK_DELETE } from '../utils/accessMask';
import type { RequestWithUser } from '../types/request';
import {
  fullCycleCheckDurationSeconds,
  fullCycleChecksTotal,
  fullCycleStageDurationSeconds,
  fullCycleStageFailuresTotal,
  systemCriticalErrorsTotal,
} from '../metrics';

export type FullCycleStage =
  | 'setup'
  | 'prepare_fixtures'
  | 'create_task'
  | 'telegram_check'
  | 'delete_task'
  | 'verify_task_deleted'
  | 'verify_files_cleanup'
  | 'finish';

export type FullCycleLogEntry = {
  ts: string;
  stage: FullCycleStage;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
};

export type FullCycleCheckReport = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  taskId?: string;
  fileIds: string[];
  logs: FullCycleLogEntry[];
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_MS = 3_000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const nowIso = (): string => new Date().toISOString();

const extractFileId = (url: unknown): string | null => {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/api\/v1\/files\/([^/?#]+)/);
  return match?.[1] ?? null;
};

const createFixtures = (): Array<{
  name: string;
  mime: string;
  data: Buffer;
}> => {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlB2X8AAAAASUVORK5CYII=';

  return [
    {
      name: 'sample.txt',
      mime: 'text/plain',
      data: Buffer.from('full cycle check text file\n', 'utf8'),
    },
    {
      name: 'sample.pdf',
      mime: 'application/pdf',
      data: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
      ),
    },
    {
      name: 'sample.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from('PK\x03\x04dummy-xlsx', 'utf8'),
    },
    {
      name: 'sample.mp4',
      mime: 'video/mp4',
      data: Buffer.from('00000020667479706d703432', 'hex'),
    },
    {
      name: 'sample.jpg',
      mime: 'image/jpeg',
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    },
    {
      name: 'sample.png',
      mime: 'image/png',
      data: Buffer.from(pngBase64, 'base64'),
    },
  ];
};

const getBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
};

const resolveTaskApiToken = (
  req: Request,
): { token: string; source: 'bearer' | 'elevated_admin' } => {
  const bearerToken = getBearerToken(req);
  const user = (req as RequestWithUser).user;
  const hasTaskDeleteAccess =
    typeof user?.access === 'number' &&
    (user.access & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE;

  if (bearerToken && hasTaskDeleteAccess) {
    return { token: bearerToken, source: 'bearer' };
  }

  if (
    user &&
    (typeof user.id === 'string' || typeof user.id === 'number') &&
    typeof user.username === 'string' &&
    typeof user.role === 'string'
  ) {
    return {
      token: generateShortToken({
        id: user.id,
        username: user.username,
        role: user.role,
        access: Number(user.access ?? 0) | ACCESS_MANAGER | ACCESS_TASK_DELETE,
      }),
      source: 'elevated_admin',
    };
  }

  if (bearerToken) {
    return { token: bearerToken, source: 'bearer' };
  }

  throw new Error(
    'Не удалось получить токен для выполнения full-cycle проверки.',
  );
};

const resolveAssigneeId = async (req: Request): Promise<number> => {
  const user = (req as RequestWithUser).user;
  const candidates = [
    user?.id,
    (user as { telegram_id?: unknown })?.telegram_id,
  ];
  for (const candidate of candidates) {
    const normalized = Number(candidate);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
  }

  const username =
    typeof user?.username === 'string' ? user.username.trim() : undefined;
  if (username) {
    const byUsername = await User.findOne({ username })
      .select({ telegram_id: 1 })
      .lean<{ telegram_id?: unknown } | null>();
    const telegramId = Number(byUsername?.telegram_id);
    if (Number.isFinite(telegramId) && telegramId > 0) {
      return telegramId;
    }
  }

  const fallbackUser = await User.findOne({ telegram_id: { $type: 'number' } })
    .sort({ is_service_account: 1, role: 1, telegram_id: 1 })
    .select({ telegram_id: 1 })
    .lean<{ telegram_id?: unknown } | null>();
  const fallbackId = Number(fallbackUser?.telegram_id);
  if (Number.isFinite(fallbackId) && fallbackId > 0) {
    return fallbackId;
  }

  throw new Error(
    'Не удалось определить assigned_user_id для full-cycle проверки.',
  );
};

const resolveBaseUrl = (req: Request): string => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length > 0
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;
  const host = req.get('host');
  return `${protocol || 'http'}://${host || 'localhost:3000'}`;
};

const createLogger = (logs: FullCycleLogEntry[]) => {
  return (
    stage: FullCycleStage,
    level: FullCycleLogEntry['level'],
    message: string,
    details?: Record<string, unknown>,
  ) => {
    logs.push({
      ts: nowIso(),
      stage,
      level,
      message,
      ...(details ? { details } : {}),
    });
  };
};

const tryParseJson = (value: string): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const resolveTaskIdFromPayload = (
  payload: Record<string, unknown> | null,
): string | undefined => {
  if (!payload) return undefined;

  const candidates: unknown[] = [
    payload._id,
    payload.id,
    (payload.task as Record<string, unknown> | undefined)?._id,
    (payload.task as Record<string, unknown> | undefined)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return undefined;
};

const resolveFailedStage = (logs: FullCycleLogEntry[]): FullCycleStage => {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const entry = logs[i];
    if (entry.level === 'error' && entry.stage !== 'finish') {
      return entry.stage;
    }
  }
  return 'finish';
};

const stageTimer = () => {
  const startedAt = Date.now();
  return {
    end: (stage: FullCycleStage, status: 'success' | 'failed') => {
      fullCycleStageDurationSeconds.observe(
        { stage, status },
        (Date.now() - startedAt) / 1000,
      );
    },
  };
};

const classifyFailureReason = (message: string): string => {
  const normalized = message.toLowerCase();
  if (normalized.includes('timeout')) return 'timeout';
  if (normalized.includes('telegram')) return 'telegram';
  if (normalized.includes('token')) return 'auth';
  if (normalized.includes('assigned_user_id')) return 'assignee';
  return 'runtime';
};

export async function runFullCycleCheck(
  req: Request,
  options?: {
    timeoutMs?: number;
    pollMs?: number;
    strictTelegram?: boolean;
  },
): Promise<FullCycleCheckReport> {
  const checkStartedAtMs = Date.now();
  const startedAt = nowIso();
  const logs: FullCycleLogEntry[] = [];
  const log = createLogger(logs);
  const timeoutMs = Math.max(
    3_000,
    Number(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  const pollMs = Math.max(1_000, Number(options?.pollMs ?? DEFAULT_POLL_MS));
  const strictTelegram = options?.strictTelegram !== false;
  const { token, source: tokenSource } = resolveTaskApiToken(req);
  const assigneeId = await resolveAssigneeId(req);

  const baseUrl = resolveBaseUrl(req);
  const apiRoot = new URL('/api/v1', baseUrl).toString().replace(/\/$/, '');
  const fileIds: string[] = [];
  let taskId: string | undefined;
  let stageFailureRecorded = false;

  try {
    log('setup', 'info', 'Старт full-cycle проверки', {
      baseUrl,
      timeoutMs,
      pollMs,
      strictTelegram,
      tokenSource,
      assigneeId,
    });

    const fixtures = createFixtures();
    log('prepare_fixtures', 'info', `Подготовлено файлов: ${fixtures.length}`, {
      files: fixtures.map((file) => ({ name: file.name, mime: file.mime })),
    });

    const createBody = new FormData();
    createBody.set('formVersion', '1');
    createBody.set('title', `Full cycle check ${Date.now()}`);
    createBody.set(
      'task_description',
      'Автотест полного цикла: вложения + Telegram + очистка',
    );
    createBody.set('assigned_user_id', String(assigneeId));

    for (const fixture of fixtures) {
      createBody.append(
        'files',
        new Blob([new Uint8Array(fixture.data)], { type: fixture.mime }),
        fixture.name,
      );
    }

    const createStage = stageTimer();
    const createResponse = await fetch(`${apiRoot}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: createBody,
    });
    const createText = await createResponse.text();
    const createPayload = tryParseJson(createText);

    taskId = resolveTaskIdFromPayload(createPayload);

    if (!createResponse.ok || !taskId) {
      createStage.end('create_task', 'failed');
      log('create_task', 'error', 'Не удалось создать задачу', {
        status: createResponse.status,
        body: createText,
      });
      fullCycleStageFailuresTotal.inc({
        stage: 'create_task',
        reason: !createResponse.ok ? 'http_error' : 'task_id_missing',
        http_status: String(createResponse.status),
        strict_telegram: strictTelegram ? 'true' : 'false',
      });
      stageFailureRecorded = true;
      throw new Error('Этап create_task завершился ошибкой');
    }

    const responseTask =
      createPayload?.task && typeof createPayload.task === 'object'
        ? (createPayload.task as Record<string, unknown>)
        : null;
    const attachmentsSource = Array.isArray(createPayload?.attachments)
      ? createPayload.attachments
      : responseTask?.attachments;
    const attachments = Array.isArray(attachmentsSource)
      ? (attachmentsSource as Array<Record<string, unknown>>)
      : [];
    for (const attachment of attachments) {
      const fileId = extractFileId(attachment?.url);
      if (fileId) fileIds.push(fileId);
    }

    log('create_task', 'info', `Задача создана: ${taskId}`, {
      attachments: attachments.length,
      fileIds,
    });
    createStage.end('create_task', 'success');

    const telegramStage = stageTimer();
    let telegramReady = false;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const taskResponse = await fetch(`${apiRoot}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const taskText = await taskResponse.text();
      const taskPayload = tryParseJson(taskText);
      const task = taskPayload?.task as Record<string, unknown> | undefined;

      if (!taskResponse.ok || !task) {
        log(
          'telegram_check',
          'warn',
          `Не удалось прочитать задачу при опросе Telegram (HTTP ${taskResponse.status})`,
        );
        await wait(pollMs);
        continue;
      }

      const attachmentsMessageIds = Array.isArray(
        task.telegram_attachments_message_ids,
      )
        ? task.telegram_attachments_message_ids
        : [];
      const hasTelegramSignal =
        Number.isFinite(task.telegram_message_id as number) ||
        Number.isFinite(task.telegram_topic_id as number) ||
        attachmentsMessageIds.length > 0 ||
        (Array.isArray(task.telegram_dm_message_ids) &&
          task.telegram_dm_message_ids.length > 0);

      if (hasTelegramSignal) {
        telegramReady = true;
        log('telegram_check', 'info', 'Найдены Telegram-метаданные задачи', {
          telegram_message_id: task.telegram_message_id ?? null,
          telegram_topic_id: task.telegram_topic_id ?? null,
          telegram_attachments_message_ids: attachmentsMessageIds,
          telegram_dm_message_ids: task.telegram_dm_message_ids ?? [],
        });
        break;
      }

      await wait(pollMs);
    }

    if (!telegramReady) {
      telegramStage.end('telegram_check', 'failed');
      log(
        'telegram_check',
        strictTelegram ? 'error' : 'warn',
        `Telegram-метаданные не появились за ${timeoutMs}ms`,
      );
      fullCycleStageFailuresTotal.inc({
        stage: 'telegram_check',
        reason: 'timeout',
        http_status: 'none',
        strict_telegram: strictTelegram ? 'true' : 'false',
      });
      stageFailureRecorded = true;
      if (strictTelegram) {
        throw new Error('Этап telegram_check завершился ошибкой');
      }
    } else {
      telegramStage.end('telegram_check', 'success');
    }

    const deleteStage = stageTimer();
    const deleteResponse = await fetch(`${apiRoot}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const deleteText = await deleteResponse.text();
    if (deleteResponse.status !== 204) {
      deleteStage.end('delete_task', 'failed');
      log('delete_task', 'error', 'Не удалось удалить задачу', {
        status: deleteResponse.status,
        body: deleteText,
      });
      fullCycleStageFailuresTotal.inc({
        stage: 'delete_task',
        reason: 'http_error',
        http_status: String(deleteResponse.status),
        strict_telegram: strictTelegram ? 'true' : 'false',
      });
      stageFailureRecorded = true;
      throw new Error('Этап delete_task завершился ошибкой');
    }

    const deletedTaskId = taskId;
    log('delete_task', 'info', `Задача удалена: ${deletedTaskId}`);
    deleteStage.end('delete_task', 'success');
    taskId = undefined;

    const verifyDeletedStage = stageTimer();
    const checkDeletedResponse = await fetch(
      `${apiRoot}/tasks/${deletedTaskId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (checkDeletedResponse.status !== 404) {
      verifyDeletedStage.end('verify_task_deleted', 'failed');
      log(
        'verify_task_deleted',
        'error',
        `Ожидали 404 после удаления, получили ${checkDeletedResponse.status}`,
      );
      fullCycleStageFailuresTotal.inc({
        stage: 'verify_task_deleted',
        reason: 'unexpected_status',
        http_status: String(checkDeletedResponse.status),
        strict_telegram: strictTelegram ? 'true' : 'false',
      });
      stageFailureRecorded = true;
      throw new Error('Этап verify_task_deleted завершился ошибкой');
    }

    log('verify_task_deleted', 'info', 'Подтверждено удаление задачи (404)');
    verifyDeletedStage.end('verify_task_deleted', 'success');

    const verifyFilesStage = stageTimer();
    for (const fileId of fileIds) {
      const fileResponse = await fetch(`${apiRoot}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      log(
        'verify_files_cleanup',
        fileResponse.status === 404 ? 'info' : 'warn',
        fileResponse.status === 404
          ? `Файл ${fileId} удалён`
          : `Файл ${fileId} остался доступен (HTTP ${fileResponse.status})`,
      );
      if (fileResponse.status !== 404) {
        fullCycleStageFailuresTotal.inc({
          stage: 'verify_files_cleanup',
          reason: 'file_not_deleted',
          http_status: String(fileResponse.status),
          strict_telegram: strictTelegram ? 'true' : 'false',
        });
        stageFailureRecorded = true;
      }
    }
    verifyFilesStage.end('verify_files_cleanup', 'success');

    log('finish', 'info', 'Full-cycle проверка завершена');
    fullCycleCheckDurationSeconds.observe(
      {
        status: 'success',
        strict_telegram: strictTelegram ? 'true' : 'false',
      },
      (Date.now() - checkStartedAtMs) / 1000,
    );
    fullCycleChecksTotal.inc({
      status: 'success',
      failed_stage: 'none',
      strict_telegram: strictTelegram ? 'true' : 'false',
    });

    return {
      ok: true,
      startedAt,
      finishedAt: nowIso(),
      fileIds,
      logs,
    };
  } catch (error) {
    if (taskId) {
      try {
        await fetch(`${apiRoot}/tasks/${taskId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        log(
          'delete_task',
          'warn',
          `Rollback: удалили задачу ${taskId} после ошибки`,
        );
      } catch (rollbackError) {
        log('delete_task', 'error', 'Rollback удаления задачи не удался', {
          error:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        });
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    const failedStage = resolveFailedStage(logs);
    log('finish', 'error', message);

    if (!stageFailureRecorded) {
      fullCycleStageFailuresTotal.inc({
        stage: failedStage,
        reason: classifyFailureReason(message),
        http_status: 'none',
        strict_telegram: strictTelegram ? 'true' : 'false',
      });
    }
    fullCycleCheckDurationSeconds.observe(
      {
        status: 'failed',
        strict_telegram: strictTelegram ? 'true' : 'false',
      },
      (Date.now() - checkStartedAtMs) / 1000,
    );

    fullCycleChecksTotal.inc({
      status: 'failed',
      failed_stage: failedStage,
      strict_telegram: strictTelegram ? 'true' : 'false',
    });
    systemCriticalErrorsTotal.inc({
      component: 'system',
      operation: 'full_cycle_check',
      reason: failedStage,
    });

    return {
      ok: false,
      startedAt,
      finishedAt: nowIso(),
      taskId,
      fileIds,
      logs,
    };
  }
}

export default { runFullCycleCheck };
