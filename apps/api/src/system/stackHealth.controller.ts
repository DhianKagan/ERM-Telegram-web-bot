// Назначение: контроллер админской проверки инфраструктуры
// Основные модули: express, tsyringe, StackHealthService
import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { QueueName } from 'shared';
import StackHealthService, {
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

@injectable()
export default class StackHealthController {
  constructor(
    @inject(TOKENS.StackHealthService)
    private readonly service: StackHealthService,
  ) {}

  run = async (_req: Request, res: Response): Promise<void> => {
    const proxyUrl = pickEnv([
      'PROXY_PRIVATE_URL',
      'GEOCODER_PROXY_URL',
      'GEOCODER_URL',
    ]);
    const proxyToken = pickEnv(['PROXY_TOKEN', 'GEOCODER_PROXY_TOKEN']);
    const redisUrl = pickEnv(['QUEUE_REDIS_URL', 'REDIS_URL']);
    const queuePrefix = pickEnv(['QUEUE_PREFIX']);
    const queueNamesRaw = pickEnv(['HEALTH_QUEUE_NAMES']);
    const knownQueueNames = new Set<string>(Object.values(QueueName));

    const report: StackHealthReport = await this.service.run({
      proxyUrl,
      proxyToken,
      redisUrl,
      queuePrefix,
      queueNames: queueNamesRaw
        ? (queueNamesRaw
            .split(',')
            .map((value) => value.trim())
            .filter((value) => knownQueueNames.has(value)) as QueueName[])
        : undefined,
    });

    res.json(report);
  };
}
