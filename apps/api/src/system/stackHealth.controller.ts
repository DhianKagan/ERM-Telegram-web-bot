// Назначение: контроллер админской проверки инфраструктуры
// Основные модули: express, tsyringe, StackHealthService
import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { QueueName } from 'shared';
import StackHealthService, {
  type RemoteHealthTarget,
  type StackHealthReport,
} from './stackHealth.service';
import { TOKENS } from '../di/tokens';

const pickEnv = (keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const parseRemoteServices = (
  source: string | undefined,
): RemoteHealthTarget[] => {
  if (!source) return [];

  const parsedTargets: RemoteHealthTarget[] = [];
  for (const rawItem of source.split(',')) {
    const item = rawItem.trim();
    if (!item) continue;

    const [nameRaw, urlRaw, timeoutRaw] = item
      .split('|')
      .map((part) => part.trim());
    if (!nameRaw || !urlRaw) continue;

    try {
      const parsedUrl = new URL(urlRaw);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        continue;
      }

      const timeoutCandidate = timeoutRaw
        ? Number.parseInt(timeoutRaw, 10)
        : undefined;
      const timeoutMs =
        typeof timeoutCandidate === 'number' &&
        Number.isFinite(timeoutCandidate)
          ? timeoutCandidate
          : undefined;

      parsedTargets.push({
        name: nameRaw,
        url: parsedUrl.toString(),
        timeoutMs,
      });
    } catch {
      continue;
    }
  }
  return parsedTargets;
};

@injectable()
export default class StackHealthController {
  constructor(
    @inject(TOKENS.StackHealthService)
    private readonly service: StackHealthService,
  ) {}

  run = async (_req: Request, res: Response): Promise<void> => {
    const redisUrl = pickEnv(['QUEUE_REDIS_URL', 'REDIS_URL']);
    const queuePrefix = pickEnv(['QUEUE_PREFIX']);
    const queueNamesRaw = pickEnv(['HEALTH_QUEUE_NAMES']);
    const remoteServicesRaw = pickEnv(['HEALTH_REMOTE_SERVICES']);
    const knownQueueNames = new Set<string>(Object.values(QueueName));

    const report: StackHealthReport = await this.service.run({
      redisUrl,
      queuePrefix,
      queueNames: queueNamesRaw
        ? (queueNamesRaw
            .split(',')
            .map((value) => value.trim())
            .filter((value) => knownQueueNames.has(value)) as QueueName[])
        : undefined,
      remoteServices: parseRemoteServices(remoteServicesRaw),
    });

    res.json(report);
  };
}
