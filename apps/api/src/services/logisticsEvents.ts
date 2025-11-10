// Назначение: публикация и подписка на события логистики через SSE.
// Основные модули: events, shared.

import { EventEmitter } from 'node:events';
import type {
  LogisticsEvent,
  LogisticsHeartbeatEvent,
  LogisticsInitEvent,
  LogisticsRoutePlanRemovedEvent,
  LogisticsRoutePlanUpdatedEvent,
  LogisticsTasksChangedEvent,
  RoutePlan,
} from 'shared';

const emitter = new EventEmitter();
const EVENT_NAME = 'logistics:event';
emitter.setMaxListeners(100);

const nowIso = (): string => new Date().toISOString();

export function publishLogisticsEvent(event: LogisticsEvent): void {
  emitter.emit(EVENT_NAME, event);
}

export function subscribeLogisticsEvents(
  listener: (event: LogisticsEvent) => void,
): () => void {
  emitter.on(EVENT_NAME, listener);
  return () => {
    emitter.off(EVENT_NAME, listener);
  };
}

export function createInitEvent(): LogisticsInitEvent {
  return {
    type: 'logistics.init',
    timestamp: nowIso(),
  } satisfies LogisticsInitEvent;
}

export function createHeartbeatEvent(): LogisticsHeartbeatEvent {
  return {
    type: 'logistics.heartbeat',
    timestamp: nowIso(),
  } satisfies LogisticsHeartbeatEvent;
}

export function notifyTasksChanged(
  action: LogisticsTasksChangedEvent['action'],
  taskIds: string[],
): void {
  const uniqueIds = Array.from(new Set(taskIds.filter((id) => typeof id === 'string' && id)));
  const event: LogisticsTasksChangedEvent = {
    type: 'tasks.changed',
    timestamp: nowIso(),
    action,
    taskIds: uniqueIds,
  };
  publishLogisticsEvent(event);
}

export function notifyRoutePlanUpdated(
  plan: RoutePlan,
  reason: LogisticsRoutePlanUpdatedEvent['reason'],
): void {
  const event: LogisticsRoutePlanUpdatedEvent = {
    type: 'route-plan.updated',
    timestamp: nowIso(),
    reason,
    plan,
  };
  publishLogisticsEvent(event);
}

export function notifyRoutePlanRemoved(planId: string): void {
  const event: LogisticsRoutePlanRemovedEvent = {
    type: 'route-plan.removed',
    timestamp: nowIso(),
    planId,
  };
  publishLogisticsEvent(event);
}

export default {
  publishLogisticsEvent,
  subscribeLogisticsEvents,
  createInitEvent,
  createHeartbeatEvent,
  notifyTasksChanged,
  notifyRoutePlanUpdated,
  notifyRoutePlanRemoved,
};
