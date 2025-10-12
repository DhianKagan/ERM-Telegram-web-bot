// Назначение файла: проверка состояния сервисов API.
// Основные модули: express, mongoose, node:perf_hooks.
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';

type DependencyStatus = 'up' | 'down';

type MongoHealth = {
  status: DependencyStatus;
  latencyMs?: number;
  message?: string;
};

export type HealthPayload = {
  status: 'ok' | 'error';
  timestamp: string;
  checks: {
    mongo: MongoHealth;
  };
};

export async function checkMongoHealth(): Promise<MongoHealth> {
  const { connection } = mongoose;
  if (connection.readyState !== 1) {
    return {
      status: 'down',
      message: `Состояние подключения: ${connection.readyState}`,
    };
  }

  const db = connection.db;
  if (!db) {
    return {
      status: 'down',
      message: 'Экземпляр базы данных недоступен',
    };
  }

  try {
    const start = performance.now();
    await db.command({ ping: 1 });
    const duration = Math.round(performance.now() - start);
    return {
      status: 'up',
      latencyMs: duration,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      status: 'down',
      message: err?.message ?? 'Неизвестная ошибка MongoDB',
    };
  }
}

export async function collectHealthStatus(): Promise<HealthPayload> {
  const mongo = await checkMongoHealth();
  const overall = mongo.status === 'up' ? 'ok' : 'error';
  return {
    status: overall,
    timestamp: new Date().toISOString(),
    checks: { mongo },
  };
}

export default async function healthcheck(
  _req: Request,
  res: Response,
): Promise<void> {
  const payload = await collectHealthStatus();
  const httpStatus = payload.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(payload);
}
