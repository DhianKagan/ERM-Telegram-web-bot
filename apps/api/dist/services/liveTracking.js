"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishTrackingEvent = publishTrackingEvent;
exports.subscribeTrackingEvents = subscribeTrackingEvents;
exports.getTrackingEmitter = getTrackingEmitter;
// Сервис событий живого трекинга транспорта
// Основные модули: events, shared/TrackingEvent
const node_events_1 = require("node:events");
const emitter = new node_events_1.EventEmitter();
emitter.setMaxListeners(100);
function publishTrackingEvent(event) {
    emitter.emit('event', event);
}
function subscribeTrackingEvents(listener) {
    emitter.on('event', listener);
    return () => {
        emitter.off('event', listener);
    };
}
function getTrackingEmitter() {
    return emitter;
}
