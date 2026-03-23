import {
  __resetQueueAvailabilityForTests,
  isQueueAvailable,
  markQueueAvailable,
  markQueueUnavailable,
  queueConfig,
} from '../src/config/queue';

describe('queueConfig availability circuit breaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetQueueAvailabilityForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetQueueAvailabilityForTests();
  });

  test('temporarily disables BullMQ after connection failure and restores it after cooldown', () => {
    const originalConnection = queueConfig.connection;
    const originalEnabled = queueConfig.enabled;

    queueConfig.connection = { url: 'redis://127.0.0.1:6379' };
    queueConfig.enabled = true;

    markQueueUnavailable();

    expect(isQueueAvailable()).toBe(false);

    jest.advanceTimersByTime(queueConfig.reconnectCooldownMs - 1);
    expect(isQueueAvailable()).toBe(false);

    jest.advanceTimersByTime(1);
    expect(isQueueAvailable()).toBe(true);

    queueConfig.connection = originalConnection;
    queueConfig.enabled = originalEnabled;
  });

  test('markQueueAvailable clears degraded state immediately', () => {
    const originalConnection = queueConfig.connection;
    const originalEnabled = queueConfig.enabled;

    queueConfig.connection = { url: 'redis://127.0.0.1:6379' };
    queueConfig.enabled = true;

    markQueueUnavailable();
    expect(isQueueAvailable()).toBe(false);

    markQueueAvailable();
    expect(isQueueAvailable()).toBe(true);

    queueConfig.connection = originalConnection;
    queueConfig.enabled = originalEnabled;
  });
});
