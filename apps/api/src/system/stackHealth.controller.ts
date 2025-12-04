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

const normalizeBaseUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    const cleaned = parsed.toString();
    return cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
  } catch {
    return undefined;
  }
};

const deriveProxyFromRouting = (
  routingUrlRaw: string | undefined,
): { url?: string; source?: string } => {
  const normalized = normalizeBaseUrl(routingUrlRaw);
  if (!normalized) {
    return {};
  }

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return { url: parsed.origin, source: 'ROUTING_URL' };
    }

    segments.pop();
    parsed.pathname = segments.length ? `/${segments.join('/')}` : '/';
    const base = parsed.toString();
    return {
      url: base.endsWith('/') ? base.slice(0, -1) : base,
      source: 'ROUTING_URL',
    };
  } catch {
    return {};
  }
};

const selectProxyUrl = (): { url?: string; source?: string } => {
  const directCandidates: Array<{ value?: string; source: string }> = [
    { value: process.env.PROXY_PRIVATE_URL, source: 'PROXY_PRIVATE_URL' },
    { value: process.env.GEOCODER_PROXY_URL, source: 'GEOCODER_PROXY_URL' },
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeBaseUrl(candidate.value?.trim());
    if (normalized) {
      return { url: normalized, source: candidate.source };
    }
  }

  return deriveProxyFromRouting(process.env.ROUTING_URL);
};

@injectable()
export default class StackHealthController {
  constructor(
    @inject(TOKENS.StackHealthService)
    private readonly service: StackHealthService,
  ) {}

  run = async (_req: Request, res: Response): Promise<void> => {
    const proxy = selectProxyUrl();
    const proxyToken = pickEnv(['PROXY_TOKEN', 'GEOCODER_PROXY_TOKEN']);
    const redisUrl = pickEnv(['QUEUE_REDIS_URL', 'REDIS_URL']);
    const queuePrefix = pickEnv(['QUEUE_PREFIX']);
    const queueNamesRaw = pickEnv(['HEALTH_QUEUE_NAMES']);
    const knownQueueNames = new Set<string>(Object.values(QueueName));

    const report: StackHealthReport = await this.service.run({
      proxyUrl: proxy.url,
      proxySource: proxy.source,
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
