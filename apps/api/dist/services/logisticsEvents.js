"use strict";
// Назначение: публикация и подписка на события логистики через SSE.
// Основные модули: events, shared.
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishLogisticsEvent = publishLogisticsEvent;
exports.subscribeLogisticsEvents = subscribeLogisticsEvents;
exports.createInitEvent = createInitEvent;
exports.createHeartbeatEvent = createHeartbeatEvent;
exports.notifyTasksChanged = notifyTasksChanged;
exports.notifyRoutePlanUpdated = notifyRoutePlanUpdated;
exports.notifyRoutePlanRemoved = notifyRoutePlanRemoved;
const node_events_1 = require("node:events");
const emitter = new node_events_1.EventEmitter();
const EVENT_NAME = 'logistics:event';
emitter.setMaxListeners(100);
const nowIso = () => new Date().toISOString();
function publishLogisticsEvent(event) {
    emitter.emit(EVENT_NAME, event);
}
function subscribeLogisticsEvents(listener) {
    emitter.on(EVENT_NAME, listener);
    return () => {
        emitter.off(EVENT_NAME, listener);
    };
}
function createInitEvent() {
    return {
        type: 'logistics.init',
        timestamp: nowIso(),
    };
}
function createHeartbeatEvent() {
    return {
        type: 'logistics.heartbeat',
        timestamp: nowIso(),
    };
}
function notifyTasksChanged(action, taskIds) {
    const uniqueIds = Array.from(new Set(taskIds.filter((id) => typeof id === 'string' && id)));
    const event = {
        type: 'tasks.changed',
        timestamp: nowIso(),
        action,
        taskIds: uniqueIds,
    };
    publishLogisticsEvent(event);
}
function notifyRoutePlanUpdated(plan, reason) {
    const event = {
        type: 'route-plan.updated',
        timestamp: nowIso(),
        reason,
        plan,
    };
    publishLogisticsEvent(event);
}
function notifyRoutePlanRemoved(planId) {
    const event = {
        type: 'route-plan.removed',
        timestamp: nowIso(),
        planId,
    };
    publishLogisticsEvent(event);
}
exports.default = {
    publishLogisticsEvent,
    subscribeLogisticsEvents,
    createInitEvent,
    createHeartbeatEvent,
    notifyTasksChanged,
    notifyRoutePlanUpdated,
    notifyRoutePlanRemoved,
};
