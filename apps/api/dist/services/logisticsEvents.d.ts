import type { LogisticsEvent, LogisticsHeartbeatEvent, LogisticsInitEvent, LogisticsRoutePlanUpdatedEvent, LogisticsTasksChangedEvent, RoutePlan } from 'shared';
export declare function publishLogisticsEvent(event: LogisticsEvent): void;
export declare function subscribeLogisticsEvents(listener: (event: LogisticsEvent) => void): () => void;
export declare function createInitEvent(): LogisticsInitEvent;
export declare function createHeartbeatEvent(): LogisticsHeartbeatEvent;
export declare function notifyTasksChanged(action: LogisticsTasksChangedEvent['action'], taskIds: string[]): void;
export declare function notifyRoutePlanUpdated(plan: RoutePlan, reason: LogisticsRoutePlanUpdatedEvent['reason']): void;
export declare function notifyRoutePlanRemoved(planId: string): void;
declare const _default: {
    publishLogisticsEvent: typeof publishLogisticsEvent;
    subscribeLogisticsEvents: typeof subscribeLogisticsEvents;
    createInitEvent: typeof createInitEvent;
    createHeartbeatEvent: typeof createHeartbeatEvent;
    notifyTasksChanged: typeof notifyTasksChanged;
    notifyRoutePlanUpdated: typeof notifyRoutePlanUpdated;
    notifyRoutePlanRemoved: typeof notifyRoutePlanRemoved;
};
export default _default;
